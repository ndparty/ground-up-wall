import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

const MAX_REM = 1.2;
const MIN_REM = 0.5;
const STEP_REM = 0.05;
const FIT_TEXT_CLASS_PREFIX = "fit-text-";

function fitTextClass(sizeRem: number): string {
  return `${FIT_TEXT_CLASS_PREFIX}${Math.round(sizeRem * 100)}`;
}

function setMessageFontSize(el: HTMLElement, sizeRem: number): void {
  const nextClass = fitTextClass(sizeRem);
  for (const cls of [...el.classList]) {
    if (cls.startsWith(FIT_TEXT_CLASS_PREFIX)) {
      el.classList.remove(cls);
    }
  }
  el.classList.add(nextClass);
}

/** Shrink text until it fits its container (full message visible). */
export function useFitText(text: string, enabled = true): {
  wrapRef: RefObject<HTMLDivElement>;
  textRef: RefObject<HTMLParagraphElement>;
} {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;

    const fit = () => {
      let size = MAX_REM;
      setMessageFontSize(el, size);
      if (!enabled) return;
      if (wrap.clientHeight === 0) return;
      while (size > MIN_REM) {
        void el.offsetHeight;
        if (el.scrollHeight <= wrap.clientHeight) break;
        size = Math.round((size - STEP_REM) * 100) / 100;
        setMessageFontSize(el, size);
      }
    };

    const scheduleFit = () => {
      fit();
      if (wrap.clientHeight === 0) {
        requestAnimationFrame(fit);
      }
    };

    scheduleFit();
    const ro = new ResizeObserver(scheduleFit);
    ro.observe(wrap);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, enabled]);

  return { wrapRef, textRef };
}
