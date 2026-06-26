/** Pure layout math for track centering (testable without DOM). */
import type { RenderCabin } from "./train_view.ts";

export function computeAbsoluteTrackTranslate(
  stageCenterX: number,
  trackOriginX: number,
  cabinOffsetLeft: number,
  cabinWidth: number,
): number {
  const cabinLayoutCenterX = trackOriginX + cabinOffsetLeft + cabinWidth / 2;
  return stageCenterX - cabinLayoutCenterX;
}

export function readTranslateXFromElement(el: HTMLElement): number {
  const style = globalThis.getComputedStyle(el);
  const matrix = new DOMMatrixReadOnly(style.transform);
  return matrix.m41;
}

export function computeTrackTranslateX(
  stageEl: HTMLElement,
  trackEl: HTMLElement,
  activeCabinEl: HTMLElement,
): number {
  const stageRect = stageEl.getBoundingClientRect();
  const trackRect = trackEl.getBoundingClientRect();
  const currentTx = readTranslateXFromElement(trackEl);
  const trackOriginX = trackRect.left - currentTx;
  const stageCenterX = stageRect.left + stageRect.width / 2;

  return computeAbsoluteTrackTranslate(
    stageCenterX,
    trackOriginX,
    activeCabinEl.offsetLeft,
    activeCabinEl.offsetWidth,
  );
}

/** Synchronously center a cabin (no transition). */
export function centerNow(
  stageEl: HTMLElement,
  trackEl: HTMLElement,
  activeCabinEl: HTMLElement,
): number {
  const tx = computeTrackTranslateX(stageEl, trackEl, activeCabinEl);
  trackEl.style.transform = `translateX(${tx}px)`;
  return tx;
}

/** Animate track transform over durationMs. */
export function slideTo(
  trackEl: HTMLElement,
  tx: number,
  durationMs: number,
): void {
  trackEl.style.transition = `transform ${durationMs}ms ease-in-out`;
  trackEl.style.transform = `translateX(${tx}px)`;
}

export function clearTrackTransition(trackEl: HTMLElement): void {
  trackEl.style.transition = "";
}

export interface CenterTrackBinding {
  update: () => void;
  disconnect: () => void;
}

export function bindCenterTrack(
  stageEl: HTMLElement,
  trackEl: HTMLElement,
  getActiveCabinEl: () => HTMLElement | null,
): CenterTrackBinding {
  let raf = 0;

  function update() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const active = getActiveCabinEl();
      if (!active) return;
      const tx = computeTrackTranslateX(stageEl, trackEl, active);
      trackEl.style.transform = `translateX(${tx}px)`;
    });
  }

  const ro = new ResizeObserver(update);
  ro.observe(stageEl);
  ro.observe(trackEl);

  update();

  return {
    update,
    disconnect: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}

export function waitForTrackTransition(
  trackEl: HTMLElement,
  timeoutMs = 900,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      trackEl.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      resolve();
    }

    function onEnd(e: TransitionEvent) {
      if (e.target !== trackEl || e.propertyName !== "transform") return;
      finish();
    }

    const timer = setTimeout(finish, timeoutMs);
    trackEl.addEventListener("transitionend", onEnd);
  });
}

export function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Slot index delta for a cabin key between old and new windows. */
export function centerSlotDelta(
  oldWindow: RenderCabin[],
  newWindow: RenderCabin[],
  cabinKey: string,
): number {
  const oldIdx = oldWindow.findIndex((c) => c.key === cabinKey);
  const newIdx = newWindow.findIndex((c) => c.key === cabinKey);
  if (oldIdx < 0 || newIdx < 0) return 0;
  return newIdx - oldIdx;
}

/** Apply translateX += -delta * slotPitch synchronously (transition: none). */
export function compensateTrackForSlotDelta(
  trackEl: HTMLElement,
  delta: number,
  slotPitchPx: number,
): number {
  const tx = readTranslateXFromElement(trackEl);
  const next = tx - delta * slotPitchPx;
  trackEl.style.transition = "none";
  trackEl.style.transform = `translateX(${next}px)`;
  return next;
}

/** Measure horizontal pitch between the first two cabin wraps on the track. */
export function measureSlotPitchPx(trackEl: HTMLElement): number {
  const cabins = trackEl.querySelectorAll(".train-cabin-wrap");
  if (cabins.length < 2) return 0;
  const a = cabins[0] as HTMLElement;
  const b = cabins[1] as HTMLElement;
  return b.offsetLeft - a.offsetLeft;
}

/** Remove CSS class that blocks transform transitions (!important). */
export function ensureTrackCanAnimate(trackEl: HTMLElement): void {
  trackEl.classList.remove("display-wall__track--instant");
}
