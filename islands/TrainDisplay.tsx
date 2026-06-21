import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  centerNow,
  centerSlotDelta,
  clearTrackTransition,
  compensateTrackForSlotDelta,
  computeTrackTranslateX,
  ensureTrackCanAnimate,
  jumpSlideStartTx,
  measureSlotPitchPx,
  prepareJumpSlideOffset,
  slideTo,
  waitForLayout,
  waitForTrackTransition,
} from "../lib/train/center_track.ts";
import {
  applyServerWindow,
  getCenterKey,
  getCenterKeyFromSteps,
  getRenderWindow,
  getSlideSlotDistance,
  getSlideTargetKey,
  hasCabins as viewHasCabins,
  isJumpTargetInCurrentWindow,
  type TrainViewState,
} from "../lib/train/train_view.ts";
import { preloadCabinImages } from "../lib/train/preload_cabin_images.ts";
import { jumpSlideDurationMs, slideDurationMs } from "../lib/train/slide_duration.ts";
import { shouldShowTrainControls } from "../lib/train/playback.ts";
import { useTrainPlayback } from "../lib/train/use_train_playback.ts";
import { VIEWPORT_K } from "../lib/train/train_view_constants.ts";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import type { Submission } from "../lib/types.ts";
import { resolveOverrideView } from "../lib/train/display_override.ts";
import ConnectionBanner from "./ConnectionBanner.tsx";
import TrainCabin from "./TrainCabin.tsx";
import TrainControls from "./TrainControls.tsx";

interface PendingCommit {
  viewBefore: TrainViewState;
  nextWindow: TrainStep[];
  nextCabin: number;
  slidTargetKey: string | null;
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
    peekPendingAdvance,
    hasJumpPending,
    pauseTrain,
    resumeTrain,
    jumpTrain,
    syncPlaybackFromServer,
    bootstrapComplete,
    bootstrapError,
    retryBootstrap,
    connectionStatus,
    overrideState,
  } = useTrainPlayback();

  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [instantSnap, setInstantSnap] = useState(true);
  const [isSliding, setIsSliding] = useState(false);
  const [highlightReady, setHighlightReady] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [originUrl, setOriginUrl] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cabinRefs = useRef<Map<string, HTMLElement>>(new Map());
  const trainViewRef = useRef(trainView);
  const isAnimatingRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const runOrchestratorRef = useRef<(() => void) | null>(null);
  const prevOverrideViewRef = useRef<"train" | "blank" | "placeholder">("train");
  const pendingAdvancesRef = useRef(pendingAdvances);
  const peekPendingAdvanceRef = useRef(peekPendingAdvance);
  const hasJumpPendingRef = useRef(hasJumpPending);
  const pendingCommitRef = useRef<PendingCommit | null>(null);
  const recenterSuppressedRef = useRef(false);
  trainViewRef.current = trainView;
  isPlayingRef.current = isPlaying;
  pendingAdvancesRef.current = pendingAdvances;
  peekPendingAdvanceRef.current = peekPendingAdvance;
  hasJumpPendingRef.current = hasJumpPending;

  const renderNodes = getRenderWindow(trainView);
  const hasCabins = viewHasCabins(trainView) && renderNodes.length > 0;
  const centerKey = getCenterKey(trainView);
  const showControls = shouldShowTrainControls(userRole);
  const overrideView = resolveOverrideView(overrideState);

  useEffect(() => {
    setBaseUrl(globalThis.location?.host ?? "");
    setOriginUrl(globalThis.location?.origin ?? "");
  }, []);

  useEffect(() => {
    const dismissed = globalThis.localStorage?.getItem("display_wall_fullscreen_dismissed");
    if (!dismissed) setShowFullscreenPrompt(true);
    document.body.classList.add("display-wall-mode");
    document.documentElement.classList.add("display-wall-mode");
    return () => {
      document.body.classList.remove("display-wall-mode");
      document.documentElement.classList.remove("display-wall-mode");
    };
  }, []);

  useEffect(() => {
    if (!bootstrapComplete) return;
    const t = setTimeout(() => setInstantSnap(false), 50);
    return () => clearTimeout(t);
  }, [bootstrapComplete]);

  function instantRecenterOn(activeKey: string | null) {
    const stage = stageRef.current;
    const track = trackRef.current;
    const active = activeKey ? cabinRefs.current.get(activeKey) : null;
    if (!stage || !track || !active) return;
    track.style.transition = "none";
    centerNow(stage, track, active);
    requestAnimationFrame(() => clearTrackTransition(track));
  }

  function tryInstantRecenterOn(activeKey: string | null) {
    if (recenterSuppressedRef.current) return;
    instantRecenterOn(activeKey);
  }

  function queueCommitCompensation(
    viewBefore: TrainViewState,
    nextWindow: TrainStep[],
    nextCabin: number,
    slidTargetKey: string | null,
  ): void {
    pendingCommitRef.current = { viewBefore, nextWindow, nextCabin, slidTargetKey };
  }

  async function waitForCabinRef(key: string, maxFrames = 5): Promise<void> {
    for (let i = 0; i < maxFrames; i++) {
      if (cabinRefs.current.get(key)) return;
      await waitForLayout();
    }
  }

  async function recenterAfterCommit(centerKeyAfter: string | null): Promise<void> {
    if (!centerKeyAfter) return;
    await waitForLayout();
    await waitForCabinRef(centerKeyAfter);
    instantRecenterOn(centerKeyAfter);
    await waitForLayout();
  }

  function imageUrlsFromWindow(window: TrainStep[], canonical: Submission[]): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const step of window) {
      if (step.kind !== "post" || !step.submissionId) continue;
      const url = canonical.find((s) => s.id === step.submissionId)?.image_url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    return urls;
  }

  /** Synchronous post-commit transform before paint (see pendingCommitRef). */
  useLayoutEffect(() => {
    const pending = pendingCommitRef.current;
    if (!pending || !isAnimatingRef.current) return;

    const track = trackRef.current;
    if (!track) {
      pendingCommitRef.current = null;
      return;
    }

    if (pending.slidTargetKey) {
      const newWindow = applyServerWindow(
        pending.viewBefore,
        pending.nextWindow,
        pending.nextCabin,
      ).window;
      const delta = centerSlotDelta(pending.viewBefore.window, newWindow, pending.slidTargetKey);
      const slotPitch = measureSlotPitchPx(track);
      if (delta !== 0 && slotPitch > 0) {
        compensateTrackForSlotDelta(track, delta, slotPitch);
      }
    } else {
      tryInstantRecenterOn(getCenterKey(trainViewRef.current));
    }
    pendingCommitRef.current = null;
  }, [trainView.window, trainView.currentCabin]);

  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!stage || !track || !hasCabins) return;

    const ro = new ResizeObserver(() => {
      if (isAnimatingRef.current) return;
      tryInstantRecenterOn(centerKey);
    });
    ro.observe(stage);
    ro.observe(track);
    return () => ro.disconnect();
  }, [hasCabins, centerKey]);

  /** Recenter when idle (bootstrap / server sync); orchestrator recenters after each advance. */
  useLayoutEffect(() => {
    if (!hasCabins || !bootstrapComplete || overrideView !== "train") return;
    if (isAnimatingRef.current) return;
    if (pendingAdvancesRef.current > 0) return;
    if (recenterSuppressedRef.current) return;
    tryInstantRecenterOn(centerKey);
  }, [hasCabins, bootstrapComplete, centerKey, overrideView]);

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

      instantRecenterOn(getCenterKey(trainViewRef.current));
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

    async function slideToKey(targetKey: string, durationMs: number): Promise<boolean> {
      const stage = stageRef.current;
      const track = trackRef.current;
      const el = cabinRefs.current.get(targetKey);
      if (!stage || !track || !el) return false;

      ensureTrackCanAnimate(track);
      const targetTx = computeTrackTranslateX(stage, track, el);
      slideTo(track, targetTx, durationMs);
      await waitForTrackTransition(track, durationMs + 150);
      return !cancelled;
    }

    async function slideFarJumpToKey(
      targetKey: string,
      slideSteps: number,
    ): Promise<boolean> {
      const stage = stageRef.current;
      const track = trackRef.current;
      const el = cabinRefs.current.get(targetKey);
      if (!stage || !track || !el) return false;

      const durationMs = jumpSlideDurationMs(slideSteps);
      const slotPitch = measureSlotPitchPx(track);
      if (slotPitch <= 0) return false;

      const finalTx = computeTrackTranslateX(stage, track, el);
      const startTx = jumpSlideStartTx(finalTx, slideSteps, slotPitch);
      prepareJumpSlideOffset(track, startTx);
      await waitForLayout();
      slideTo(track, finalTx, durationMs);
      await waitForTrackTransition(track, durationMs + 150);
      return !cancelled;
    }

    async function drainQueue() {
      if (isAnimatingRef.current) return;
      if (pendingAdvancesRef.current <= 0) return;
      if (!isPlayingRef.current && !hasJumpPendingRef.current()) return;

      isAnimatingRef.current = true;
      setIsSliding(true);
      setHighlightReady(false);
      setInstantSnap(false);
      recenterSuppressedRef.current = true;

      try {
        while (pendingAdvancesRef.current > 0 && !cancelled) {
          if (!isPlayingRef.current && !hasJumpPendingRef.current()) break;

          const peek = peekPendingAdvanceRef.current();
          if (!peek) break;

          const view = trainViewRef.current;
          const track = trackRef.current;

          if (peek.kind === "jump") {
            const jumpCenterKey = getCenterKeyFromSteps(peek.window);
            const slideSteps = peek.slideSteps ?? 0;
            const inChain = isJumpTargetInCurrentWindow(view, peek.window);

            await preloadCabinImages(imageUrlsFromWindow(peek.window, view.canonical));
            if (cancelled) return;

            if (inChain && slideSteps > 0 && jumpCenterKey) {
              const ok = await slideToKey(jumpCenterKey, jumpSlideDurationMs(slideSteps));
              if (cancelled) return;
              if (track) clearTrackTransition(track);
              if (!ok) {
                pendingCommitRef.current = null;
                const centerKeyAfter = commitAdvance();
                await recenterAfterCommit(centerKeyAfter);
              } else {
                queueCommitCompensation(view, peek.window, peek.currentCabin, jumpCenterKey);
                commitAdvance();
                await waitForLayout();
              }
            } else {
              commitAdvance();
              await waitForLayout();
              if (jumpCenterKey) await waitForCabinRef(jumpCenterKey, 30);

              if (slideSteps > 0 && jumpCenterKey) {
                const ok = await slideFarJumpToKey(jumpCenterKey, slideSteps);
                if (cancelled) return;
                if (track) clearTrackTransition(track);
                if (!ok) instantRecenterOn(jumpCenterKey);
              } else if (jumpCenterKey) {
                instantRecenterOn(jumpCenterKey);
              }
            }
            break;
          }

          const currentCenterKey = getCenterKey(view);
          const targetKey = getSlideTargetKey(view, peek.window);

          if (targetKey && targetKey !== currentCenterKey) {
            const steps = getSlideSlotDistance(view, targetKey);
            const urls = view.window
              .map((c) => c.submission?.image_url)
              .filter((u): u is string => !!u);
            await preloadCabinImages(urls);
            if (cancelled) return;

            const ok = await slideToKey(targetKey, slideDurationMs(steps));
            if (cancelled) return;
            if (track) clearTrackTransition(track);
            if (!ok) {
              pendingCommitRef.current = null;
              const centerKeyAfter = commitAdvance();
              await recenterAfterCommit(centerKeyAfter);
              continue;
            }
          }

          if (track) clearTrackTransition(track);
          const slidTargetKey = targetKey && targetKey !== currentCenterKey ? targetKey : null;
          queueCommitCompensation(view, peek.window, peek.currentCabin, slidTargetKey);
          commitAdvance();
          await waitForLayout();
        }
      } finally {
        await waitForLayout();
        await waitForLayout();
        if (!cancelled) {
          setHighlightReady(true);
          setIsSliding(false);
          isAnimatingRef.current = false;
          setTimeout(() => {
            recenterSuppressedRef.current = false;
          }, 100);
        } else {
          recenterSuppressedRef.current = false;
          pendingCommitRef.current = null;
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
  }, [hasCabins, bootstrapComplete, commitAdvance, peekPendingAdvance, hasJumpPending]);

  useEffect(() => {
    if (!hasCabins || !bootstrapComplete) return;
    runOrchestratorRef.current?.();
  }, [hasCabins, bootstrapComplete, pendingAdvances]);

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
      <ConnectionBanner status={connectionStatus} />

      {bootstrapError && (
        <div
          style="position: fixed; inset: 0; z-index: 9998; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.75); color: white; text-align: center; padding: 2rem;"
        >
          <div>
            <p style="font-size: 1.25rem; margin: 0 0 1rem;">{bootstrapError}</p>
            <button
              type="button"
              onClick={retryBootstrap}
              style="padding: 0.75rem 1.5rem; background: #ef3340; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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
              class={`display-wall__track${
                instantSnap ? " display-wall__track--instant" : ""
              }${isSliding ? " display-wall__track--animating" : ""}`}
            >
              <div class="display-wall__rail" aria-hidden="true" />
              {renderNodes.map((node) => (
                <TrainCabin
                  key={node.key}
                  ref={(el: HTMLElement | null) => {
                    if (el) cabinRefs.current.set(node.key, el);
                    else cabinRefs.current.delete(node.key);
                  }}
                  kind={node.kind}
                  submission={node.submission}
                  destination={node.destination}
                  qrUrl={originUrl}
                  isActive={highlightReady && !isSliding && node.key === centerKey}
                  isAnimating={isSliding}
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
