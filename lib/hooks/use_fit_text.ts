import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";

export const MAX_REM = 3.0;
export const MIN_REM = 0.5;
export const MIN_WRAP_HEIGHT_PX = 24;
/** Must match centi-rem steps in static/fit-text.css (50, 55, … 300). */
export const REM_STEP_CENTI = 5;
const FIT_TEXT_CLASS_PREFIX = "fit-text-";
const FIT_TEXT_SIZE_CLASS = /^fit-text-\d+$/;
const ZERO_DIM_RETRIES = 10;
const CSS_READY_RETRIES = 10;
const PROBE_CLASS = "message-fit-probe";
/** Legacy probe markers from earlier builds. */
const LEGACY_PROBE_CLASSES = ["fit-text-probe", "fit-text-probe-host"];

export function quantizeRemCenti(centi: number): number {
  return Math.round(centi / REM_STEP_CENTI) * REM_STEP_CENTI;
}

export function fitTextClass(sizeRem: number): string {
  return `${FIT_TEXT_CLASS_PREFIX}${quantizeRemCenti(Math.round(sizeRem * 100))}`;
}

export function fitTextDataRem(sizeRem: number): string {
  return String(quantizeRemCenti(Math.round(sizeRem * 100)));
}

/** Apply fit-text class + data-fit-rem on an element (probe or live node). */
export function setFitRem(el: HTMLElement, sizeRem: number): void {
  const nextClass = fitTextClass(sizeRem);
  for (const cls of [...el.classList]) {
    if (FIT_TEXT_SIZE_CLASS.test(cls)) {
      el.classList.remove(cls);
    }
  }
  el.classList.add(nextClass);
  el.setAttribute("data-fit-rem", fitTextDataRem(sizeRem));
}

/** @deprecated Use setFitRem */
export function setMessageFontSize(el: HTMLElement, sizeRem: number): void {
  setFitRem(el, sizeRem);
}

/** Largest rem in [minRem, maxRem] where fits(sizeRem) is true (binary search on centi-rem). */
export function findMaxFittingRem(
  fits: (sizeRem: number) => boolean,
  minRem = MIN_REM,
  maxRem = MAX_REM,
): number {
  let lo = Math.ceil(Math.round(minRem * 100) / REM_STEP_CENTI);
  let hi = Math.floor(Math.round(maxRem * 100) / REM_STEP_CENTI);
  let best = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const sizeRem = (mid * REM_STEP_CENTI) / 100;
    if (fits(sizeRem)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return (best * REM_STEP_CENTI) / 100;
}

/** Resolve line-height to pixels (handles unitless ratios from CSS). */
export function lineHeightPx(fontPx: number, lineHeight: string): number {
  const parsed = parseFloat(lineHeight);
  if (!Number.isFinite(parsed)) return fontPx * 1.3;
  if (parsed < 4 && !lineHeight.includes("px") && !lineHeight.includes("%")) {
    return fontPx * parsed;
  }
  return parsed;
}

/** Pure height-based cap for tests (single-line upper bound from wrap height). */
export function computeEffectiveMaxRem(
  wrapHeight: number,
  linePx: number,
  fontPx: number,
  rootPx: number,
  maxRem = MAX_REM,
  minRem = MIN_REM,
): number {
  if (wrapHeight <= 0 || linePx <= 0 || rootPx <= 0) return minRem;
  const heightCap = wrapHeight / linePx;
  const capRem = heightCap * (fontPx / rootPx);
  return Math.min(maxRem, Math.max(minRem, capRem));
}

function verticalMarginPx(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
}

export function textFitsWrap(
  wrap: HTMLElement,
  el: HTMLElement,
  sizeRem: number,
): boolean {
  setFitRem(el, sizeRem);
  void el.offsetHeight;
  const heightBudget = wrap.clientHeight - verticalMarginPx(el);
  return el.scrollHeight <= heightBudget && el.scrollWidth <= wrap.clientWidth + 1;
}

/** True when fit-text CSS steps change computed font-size on the probe. */
export function fitTextCssReady(probe: HTMLElement): boolean {
  setFitRem(probe, MAX_REM);
  void probe.offsetHeight;
  const large = parseFloat(getComputedStyle(probe).fontSize);
  setFitRem(probe, MIN_REM);
  void probe.offsetHeight;
  const small = parseFloat(getComputedStyle(probe).fontSize);
  return large > small + 1;
}

function scrubLegacyProbes(wrap: HTMLElement): void {
  for (const probe of wrap.querySelectorAll(`.${PROBE_CLASS}`)) {
    probe.remove();
  }
  for (const legacyClass of LEGACY_PROBE_CLASSES) {
    for (const probe of wrap.querySelectorAll(`.${legacyClass}`)) {
      probe.remove();
    }
    const cabinBody = wrap.closest(".train-cabin__body");
    for (const host of cabinBody?.querySelectorAll(`:scope > .${legacyClass}`) ?? []) {
      host.remove();
    }
  }
}

function getOrCreateProbe(wrap: HTMLElement, text: string): HTMLParagraphElement {
  scrubLegacyProbes(wrap);

  let probe = wrap.querySelector<HTMLParagraphElement>(`.${PROBE_CLASS}`);
  if (!probe) {
    probe = document.createElement("p");
    probe.className = `train-cabin__message ${PROBE_CLASS}`;
    probe.setAttribute("aria-hidden", "true");
    wrap.appendChild(probe);
  }
  probe.textContent = text;
  return probe;
}

function removeProbe(wrap: HTMLElement): void {
  scrubLegacyProbes(wrap);
}

/** Binary-search the largest font size that fits the message wrap (width and height). */
export function fitTextSizeRem(
  wrap: HTMLElement,
  probe: HTMLElement,
  minRem = MIN_REM,
  maxRem = MAX_REM,
): number {
  return findMaxFittingRem(
    (sizeRem) => textFitsWrap(wrap, probe, sizeRem),
    minRem,
    maxRem,
  );
}

function wrapReadyForFit(wrap: HTMLElement): boolean {
  return wrap.clientWidth > 0 && wrap.clientHeight >= MIN_WRAP_HEIGHT_PX;
}

const fitGeneration = new WeakMap<HTMLElement, number>();

function runFitText(
  wrap: HTMLElement,
  text: string,
  enabled: boolean,
  onFit: (size: number) => void,
): void {
  const generation = (fitGeneration.get(wrap) ?? 0) + 1;
  fitGeneration.set(wrap, generation);

  let dimAttempts = 0;
  let cssAttempts = 0;

  const tryFit = () => {
    if (fitGeneration.get(wrap) !== generation) return;

    if (!enabled) {
      onFit(MAX_REM);
      return;
    }
    if (!wrapReadyForFit(wrap)) {
      if (dimAttempts < ZERO_DIM_RETRIES) {
        dimAttempts++;
        requestAnimationFrame(tryFit);
      }
      return;
    }

    try {
      const probe = getOrCreateProbe(wrap, text);

      if (!fitTextCssReady(probe)) {
        if (cssAttempts < CSS_READY_RETRIES) {
          cssAttempts++;
          requestAnimationFrame(tryFit);
          return;
        }
      }

      if (fitGeneration.get(wrap) !== generation) return;
      onFit(fitTextSizeRem(wrap, probe));
    } finally {
      if (fitGeneration.get(wrap) === generation) {
        removeProbe(wrap);
      }
    }
  };

  tryFit();
}

/** Measure and apply fit-text (for hooks and manual triggers such as image onLoad). */
export function scheduleFitText(
  wrap: HTMLElement | null,
  text: string,
  enabled = true,
  onFit?: (size: number) => void,
): void {
  if (!wrap) return;
  runFitText(wrap, text, enabled, onFit ?? (() => {}));
}

/** Shrink text until it fits its container (full message visible). */
export function useFitText(text: string, enabled = true): {
  wrapRef: RefObject<HTMLDivElement>;
  textRef: RefObject<HTMLParagraphElement>;
  sizeRem: number;
  refit: () => void;
} {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [sizeRem, setSizeRem] = useState(MAX_REM);

  const onFit = useCallback((size: number) => {
    setSizeRem((prev) => (prev === size ? prev : size));
  }, []);

  const refit = useCallback(() => {
    const wrap = wrapRef.current;
    if (wrap) runFitText(wrap, text, enabled, onFit);
  }, [text, enabled, onFit]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    scrubLegacyProbes(wrap);

    let cancelled = false;

    const scheduleFit = () => {
      if (cancelled) return;
      runFitText(wrap, text, enabled, onFit);
    };

    scheduleFit();

    const ro = new ResizeObserver(scheduleFit);
    ro.observe(wrap);
    const body = wrap.closest(".train-cabin__body");
    if (body) ro.observe(body);

    void document.fonts?.ready.then(() => {
      if (!cancelled) scheduleFit();
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      removeProbe(wrap);
    };
  }, [text, enabled, onFit]);

  return { wrapRef, textRef, sizeRem, refit };
}
