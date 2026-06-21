import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

const MAX_REM = 1.2;
const MIN_REM = 0.5;
const STEP_REM = 0.05;

function setMessageFontSize(el: HTMLElement, sizeRem: number): void {
  el.style.setProperty("--message-font-size", `${sizeRem}rem`);
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
      while (size > MIN_REM && el.scrollHeight > wrap.clientHeight) {
        size = Math.round((size - STEP_REM) * 100) / 100;
        setMessageFontSize(el, size);
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, enabled]);

  return { wrapRef, textRef };
}
