import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { DisplayOverrideCommand } from "../lib/interfaces/realtime_service.ts";
import {
  mapCommandToOverrideState,
  type OverrideState,
  resolveOverrideView,
} from "../lib/train/display_override.ts";
import {
  centerNow,
  clearTrackTransition,
  computeTrackTranslateX,
  readTranslateXFromElement,
  slideTo,
  waitForLayout,
  waitForTrackTransition,
} from "../lib/train/center_track.ts";
import {
  computeJumpAnimationPath,
  getForwardSlideTargetId,
  getRenderWindow,
} from "../lib/train/train_view.ts";
import {
  cabinsForJumpPreload,
  imageUrlsForJumpPath,
  preloadCabinImages,
} from "../lib/train/preload_cabin_images.ts";
import { slideDurationMs } from "../lib/train/slide_duration.ts";
import { shouldShowTrainControls } from "../lib/train/playback.ts";
import { useTrainPlayback } from "../lib/train/use_train_playback.ts";
import { VIEWPORT_K } from "../lib/train/train_view_constants.ts";
import TrainCabin from "./TrainCabin.tsx";
import TrainControls from "./TrainControls.tsx";

function parseSseData<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data as string) as T;
  } catch {
    return null;
  }
}

export default function TrainDisplay() {
  const {
    trainView,
    isPlaying,
    userRole,
    currentCabin,
    trainLength,
    pendingAdvances,
    commitAdvance,
    commitJumpTarget,
    pauseTrain,
    resumeTrain,
    jumpTrain,
    syncPlaybackFromServer,
    bootstrapComplete,
  } = useTrainPlayback();

  const [overrideState, setOverrideState] = useState<OverrideState>({ type: "normal" });
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [instantSnap, setInstantSnap] = useState(true);
  const [jumpPathIds, setJumpPathIds] = useState<Set<string>>(() => new Set());

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cabinRefs = useRef<Map<string, HTMLElement>>(new Map());
  const trainViewRef = useRef(trainView);
  const jumpPreloadTargetRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const pendingAdvancesRef = useRef(pendingAdvances);
  const isPlayingRef = useRef(isPlaying);
  const runOrchestratorRef = useRef<(() => void) | null>(null);
  const prevOverrideViewRef = useRef<"train" | "blank" | "placeholder">("train");
  trainViewRef.current = trainView;
  pendingAdvancesRef.current = pendingAdvances;
  isPlayingRef.current = isPlaying;

  const hasCabins = trainView.base.nodes.length > 0;
  const currentId = trainView.base.current?.submission.id;
  const renderNodes = getRenderWindow(trainView);
  const showControls = shouldShowTrainControls(userRole);
  const overrideView = resolveOverrideView(overrideState);

  useEffect(() => {
    const dismissed = globalThis.localStorage?.getItem("display_wall_fullscreen_dismissed");
    if (!dismissed) setShowFullscreenPrompt(true);
    document.body.classList.add("display-wall-mode");
    return () => document.body.classList.remove("display-wall-mode");
  }, []);

  useEffect(() => {
    fetch("/api/display/override-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((override) => {
        if (override) setOverrideState(override as OverrideState);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/display/events");
    es.addEventListener("display_override", (event) => {
      const command = parseSseData<DisplayOverrideCommand>(event);
      if (command) {
        setOverrideState(mapCommandToOverrideState(command.type, command.imageUrl));
      }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!bootstrapComplete) return;
    const t = setTimeout(() => setInstantSnap(false), 50);
    return () => clearTimeout(t);
  }, [bootstrapComplete]);

  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!stage || !track || !hasCabins) return;

    const ro = new ResizeObserver(() => {
      if (isAnimatingRef.current) return;
      const active = currentId ? cabinRefs.current.get(currentId) : null;
      if (!active) return;
      track.style.transition = "none";
      centerNow(stage, track, active);
      requestAnimationFrame(() => clearTrackTransition(track));
    });
    ro.observe(stage);
    ro.observe(track);
    return () => ro.disconnect();
  }, [hasCabins, currentId]);

  /** Flicker-free instant recenter after state commits (before paint). */
  useLayoutEffect(() => {
    if (!hasCabins || !bootstrapComplete || overrideView !== "train") return;
    if (isAnimatingRef.current) return;

    const stage = stageRef.current;
    const track = trackRef.current;
    const active = currentId ? cabinRefs.current.get(currentId) : null;
    if (!stage || !track || !active) return;

    track.style.transition = "none";
    centerNow(stage, track, active);
    requestAnimationFrame(() => clearTrackTransition(track));
  }, [hasCabins, bootstrapComplete, currentId, renderNodes.length, overrideView]);

  /** Snap to server cabin and recenter when returning from display override. */
  useEffect(() => {
    const prev = prevOverrideViewRef.current;
    prevOverrideViewRef.current = overrideView;

    if (!bootstrapComplete || !hasCabins) return;
    if (overrideView !== "train" || prev === "train") return;

    let cancelled = false;
    setInstantSnap(true);

    void (async () => {
      await syncPlaybackFromServer();
      if (cancelled) return;
      await waitForLayout();
      if (cancelled) return;

      const stage = stageRef.current;
      const track = trackRef.current;
      const activeId = trainViewRef.current.base.current?.submission.id;
      const active = activeId ? cabinRefs.current.get(activeId) : null;
      if (stage && track && active) {
        track.style.transition = "none";
        centerNow(stage, track, active);
        requestAnimationFrame(() => clearTrackTransition(track));
      }
      setTimeout(() => {
        if (!cancelled) setInstantSnap(false);
      }, 50);
    })();

    return () => {
      cancelled = true;
    };
  }, [overrideView, bootstrapComplete, hasCabins, syncPlaybackFromServer]);

  useEffect(() => {
    if (!hasCabins || !bootstrapComplete) return;

    let cancelled = false;

    async function slideToElement(
      targetEl: HTMLElement,
      steps: number,
    ): Promise<boolean> {
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!stage || !track) return false;

      const currentTx = readTranslateXFromElement(track);
      const targetTx = computeTrackTranslateX(stage, track, targetEl);
      if (targetTx > currentTx) return false;

      const duration = slideDurationMs(steps);
      slideTo(track, targetTx, duration);
      await waitForTrackTransition(track, duration + 150);
      return !cancelled;
    }

    async function drainQueue() {
      if (isAnimatingRef.current) return;

      const view = trainViewRef.current;
      const jump = view.jump;
      const hasJump = (jump?.stepsRemaining ?? 0) > 0;
      const hasPendingAdvance = pendingAdvancesRef.current > 0;
      if (!hasJump && !hasPendingAdvance) return;

      isAnimatingRef.current = true;
      try {
        if (hasJump && jump) {
          if (jumpPreloadTargetRef.current !== jump.targetCabin) {
            jumpPreloadTargetRef.current = jump.targetCabin;
            const current = view.base.current;
            if (!current) return;

            const fromCabin = current.index + 1;
            const path = computeJumpAnimationPath(
              fromCabin,
              jump.targetCabin,
              view.base.nodes.length,
            );
            const preloadCabins = cabinsForJumpPreload(
              path,
              jump.targetCabin,
              view.base.nodes.length,
            );
            const pathIds = new Set(
              preloadCabins
                .map((cabin) => view.base.nodes[cabin - 1]?.submission.id)
                .filter((id): id is string => id !== undefined),
            );
            setJumpPathIds(pathIds);
            await preloadCabinImages(
              imageUrlsForJumpPath(preloadCabins, view.base.nodes),
            );
            if (cancelled) return;
            await waitForLayout();
          }

          const fromCabin = view.base.current!.index + 1;
          const path = computeJumpAnimationPath(
            fromCabin,
            jump.targetCabin,
            view.base.nodes.length,
          );
          const steps = Math.max(0, path.length - 1);
          const targetIdx = jump.targetCabin - 1;
          const targetId = view.base.nodes[targetIdx]?.submission.id;
          const targetEl = targetId ? cabinRefs.current.get(targetId) : null;

          if (targetEl && steps > 0) {
            const slid = await slideToElement(targetEl, steps);
            if (cancelled) return;
            if (!slid) {
              commitJumpTarget();
              return;
            }
          }

          commitJumpTarget();
          jumpPreloadTargetRef.current = null;
          setJumpPathIds(new Set());
          return;
        }

        jumpPreloadTargetRef.current = null;
        setJumpPathIds(new Set());

        if (pendingAdvancesRef.current > 0 && isPlayingRef.current) {
          const nextId = getForwardSlideTargetId(view);
          const nextEl = nextId ? cabinRefs.current.get(nextId) : null;

          if (nextEl) {
            const slid = await slideToElement(nextEl, 1);
            if (cancelled) return;
            if (!slid) {
              commitAdvance();
              return;
            }
          }

          commitAdvance();
        }
      } finally {
        isAnimatingRef.current = false;
        if (!cancelled && !trainViewRef.current.jump && pendingAdvancesRef.current === 0) {
          jumpPreloadTargetRef.current = null;
          setJumpPathIds(new Set());
        }
      }
    }

    runOrchestratorRef.current = () => {
      void drainQueue();
    };

    return () => {
      cancelled = true;
      runOrchestratorRef.current = null;
    };
  }, [hasCabins, bootstrapComplete, commitAdvance, commitJumpTarget]);

  useEffect(() => {
    if (!hasCabins || !bootstrapComplete) return;
    runOrchestratorRef.current?.();
  }, [
    hasCabins,
    bootstrapComplete,
    pendingAdvances,
    trainView.jump?.targetCabin,
    trainView.jump?.stepsRemaining,
  ]);

  function dismissFullscreenPrompt() {
    globalThis.localStorage?.setItem("display_wall_fullscreen_dismissed", "1");
    setShowFullscreenPrompt(false);
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // ignore
    }
    dismissFullscreenPrompt();
  }

  return (
    <div class="display-wall">
      <link rel="stylesheet" href="/train.css" />

      {showFullscreenPrompt && (
        <div class="display-wall__fullscreen-prompt" role="dialog" aria-label="Fullscreen options">
          <div class="display-wall__fullscreen-prompt-panel">
            <button
              type="button"
              class="display-wall__fullscreen-dismiss"
              aria-label="Dismiss"
              onClick={dismissFullscreenPrompt}
            >
              ×
            </button>
            <p class="display-wall__fullscreen-prompt-text">
              Go fullscreen for the best display experience.
            </p>
            <div class="display-wall__fullscreen-prompt-actions">
              <button type="button" onClick={() => void enterFullscreen()}>Go fullscreen</button>
              <button
                type="button"
                class="display-wall__fullscreen-prompt-secondary"
                onClick={dismissFullscreenPrompt}
              >
                Not now
              </button>
            </div>
            <p class="display-wall__fullscreen-hint">You can press F11 anytime.</p>
          </div>
        </div>
      )}

      {overrideView === "blank" && <div class="display-wall__override-blank" />}

      {overrideView === "placeholder" && (
        overrideState.imageUrl
          ? (
            <div class="display-wall__override-placeholder">
              <img src={overrideState.imageUrl} alt="Placeholder" />
            </div>
          )
          : (
            <div class="display-wall__empty">
              <img src="/logo-dark.png" alt="National Day" class="display-wall__logo" />
            </div>
          )
      )}

      {overrideView === "train" && !hasCabins && (
        <div class="display-wall__empty">
          <div class="display-wall__sparkles" aria-hidden="true" />
          <img src="/logo-dark.png" alt="National Day" class="display-wall__logo" />
          <p class="display-wall__empty-title">Submissions coming soon!</p>
          <p class="display-wall__empty-subtitle">
            Happy National Day! Snap a photo, share your moment, and hop aboard the wall.
          </p>
        </div>
      )}

      {overrideView === "train" && hasCabins && (
        <div class="display-wall__stage-outer">
          <div class="display-wall__stage-fade display-wall__stage-fade--left" aria-hidden="true" />
          <div
            ref={stageRef}
            class="display-wall__stage"
            data-viewport-k={VIEWPORT_K}
          >
            <div
              ref={trackRef}
              class={`display-wall__track${instantSnap ? " display-wall__track--instant" : ""}`}
            >
              {renderNodes.map((node) => (
                <TrainCabin
                  key={node.submission.id}
                  ref={(el) => {
                    if (el) cabinRefs.current.set(node.submission.id, el);
                    else cabinRefs.current.delete(node.submission.id);
                  }}
                  submission={node.submission}
                  isActive={node.submission.id === currentId}
                  index={node.index}
                  lazyImage={
                    !jumpPathIds.has(node.submission.id) &&
                    node.submission.id !== currentId
                  }
                />
              ))}
            </div>
          </div>
          <div class="display-wall__stage-fade display-wall__stage-fade--right" aria-hidden="true" />
        </div>
      )}

      {showControls && hasCabins && (
        <TrainControls
          isPlaying={isPlaying}
          onPause={() => void pauseTrain()}
          onPlay={() => void resumeTrain()}
          onJump={(n) => void jumpTrain(n)}
          trainLength={trainLength}
          currentCabin={currentCabin}
        />
      )}
    </div>
  );
}
