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
  getCenterKey,
  getForwardSlideTargetKey,
  getRenderWindow,
  hasCabins as viewHasCabins,
  needsAnimationStep,
} from "../lib/train/train_view.ts";
import { preloadCabinImages } from "../lib/train/preload_cabin_images.ts";
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
    applyAnimationStep,
    pauseTrain,
    resumeTrain,
    jumpTrain,
    syncPlaybackFromServer,
    bootstrapComplete,
  } = useTrainPlayback();

  const [overrideState, setOverrideState] = useState<OverrideState>({ type: "normal" });
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [instantSnap, setInstantSnap] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cabinRefs = useRef<Map<string, HTMLElement>>(new Map());
  const trainViewRef = useRef(trainView);
  const isAnimatingRef = useRef(false);
  const pendingAdvancesRef = useRef(pendingAdvances);
  const isPlayingRef = useRef(isPlaying);
  const runOrchestratorRef = useRef<(() => void) | null>(null);
  const jumpPreloadKeyRef = useRef<string | null>(null);
  const prevOverrideViewRef = useRef<"train" | "blank" | "placeholder">("train");
  trainViewRef.current = trainView;
  pendingAdvancesRef.current = pendingAdvances;
  isPlayingRef.current = isPlaying;

  const renderNodes = getRenderWindow(trainView);
  const hasCabins = viewHasCabins(trainView) && renderNodes.length > 0;
  const centerKey = getCenterKey(trainView);
  const showControls = shouldShowTrainControls(userRole);
  const overrideView = resolveOverrideView(overrideState);

  useEffect(() => {
    setBaseUrl(globalThis.location?.host ?? "");
  }, []);

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
      const active = centerKey ? cabinRefs.current.get(centerKey) : null;
      if (!active) return;
      track.style.transition = "none";
      centerNow(stage, track, active);
      requestAnimationFrame(() => clearTrackTransition(track));
    });
    ro.observe(stage);
    ro.observe(track);
    return () => ro.disconnect();
  }, [hasCabins, centerKey]);

  /** Flicker-free instant recenter after state commits (before paint). */
  useLayoutEffect(() => {
    if (!hasCabins || !bootstrapComplete || overrideView !== "train") return;
    if (isAnimatingRef.current) return;

    const stage = stageRef.current;
    const track = trackRef.current;
    const active = centerKey ? cabinRefs.current.get(centerKey) : null;
    if (!stage || !track || !active) return;

    track.style.transition = "none";
    centerNow(stage, track, active);
    requestAnimationFrame(() => clearTrackTransition(track));
  }, [hasCabins, bootstrapComplete, centerKey, renderNodes.length, overrideView]);

  /** Snap to server window and recenter when returning from display override. */
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
      const activeKey = getCenterKey(trainViewRef.current);
      const active = activeKey ? cabinRefs.current.get(activeKey) : null;
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

    async function slideToKey(targetKey: string, steps: number): Promise<boolean> {
      const stage = stageRef.current;
      const track = trackRef.current;
      const el = cabinRefs.current.get(targetKey);
      if (!stage || !track || !el) return false;

      const currentTx = readTranslateXFromElement(track);
      const targetTx = computeTrackTranslateX(stage, track, el);
      if (targetTx > currentTx) return false;

      const duration = slideDurationMs(steps);
      slideTo(track, targetTx, duration);
      await waitForTrackTransition(track, duration + 150);
      return !cancelled;
    }

    async function drainQueue() {
      if (isAnimatingRef.current) return;

      const view = trainViewRef.current;
      const jumping = needsAnimationStep(view);
      const hasPendingAdvance = pendingAdvancesRef.current > 0;
      if (!jumping && !hasPendingAdvance) return;

      isAnimatingRef.current = true;
      try {
        if (jumping && view.jump) {
          const jumpKey = `${view.jump.targetCabin}:${view.jump.stepsRemaining}`;
          if (jumpPreloadKeyRef.current !== view.jump.targetCabin.toString()) {
            jumpPreloadKeyRef.current = view.jump.targetCabin.toString();
            const urls = view.jump.renderWindow
              .map((c) => c.submission?.image_url)
              .filter((u): u is string => !!u);
            await preloadCabinImages(urls);
            if (cancelled) return;
            await waitForLayout();
          }
          void jumpKey;
          const targetKey = getForwardSlideTargetKey(view);
          if (targetKey) {
            const ok = await slideToKey(targetKey, 1);
            if (cancelled) return;
            if (!ok) {
              applyAnimationStep();
              return;
            }
          }
          applyAnimationStep();
          return;
        }

        jumpPreloadKeyRef.current = null;

        if (pendingAdvancesRef.current > 0 && isPlayingRef.current) {
          const targetKey = getForwardSlideTargetKey(view);
          if (targetKey) {
            const ok = await slideToKey(targetKey, 1);
            if (cancelled) return;
            if (!ok) {
              commitAdvance();
              return;
            }
          }
          commitAdvance();
        }
      } finally {
        isAnimatingRef.current = false;
      }
    }

    runOrchestratorRef.current = () => {
      void drainQueue();
    };

    return () => {
      cancelled = true;
      runOrchestratorRef.current = null;
    };
  }, [hasCabins, bootstrapComplete, commitAdvance, applyAnimationStep]);

  useEffect(() => {
    if (!hasCabins || !bootstrapComplete) return;
    runOrchestratorRef.current?.();
  }, [
    hasCabins,
    bootstrapComplete,
    pendingAdvances,
    trainView.jump?.stepsRemaining,
    trainView.jump?.centerIndex,
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

      {baseUrl && overrideView === "train" && (
        <div class="display-wall__join-bar" aria-hidden="true">
          <span class="display-wall__join-text">
            Want in? Visit <strong>{baseUrl}</strong> on your phone to share a photo
          </span>
        </div>
      )}

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
                  key={node.key}
                  ref={(el: HTMLElement | null) => {
                    if (el) cabinRefs.current.set(node.key, el);
                    else cabinRefs.current.delete(node.key);
                  }}
                  kind={node.kind}
                  submission={node.submission}
                  baseUrl={baseUrl}
                  isActive={node.key === centerKey}
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
