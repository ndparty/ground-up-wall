import { useEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";

const MAX_REM = 1.2;
const MIN_REM = 0.5;
const STEP_REM = 0.05;

/** Shrink text until it fits its container (full message visible). */
export function useFitText(text: string, enabled = true): {
  wrapRef: RefObject<HTMLDivElement>;
  textRef: RefObject<HTMLParagraphElement>;
  fontSizeRem: number;
} {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontSizeRem, setFontSizeRem] = useState(MAX_REM);

  useEffect(() => {
    if (!enabled) {
      setFontSizeRem(MAX_REM);
      return;
    }

    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;

    const fit = () => {
      let size = MAX_REM;
      el.style.fontSize = `${size}rem`;
      while (size > MIN_REM && el.scrollHeight > wrap.clientHeight) {
        size = Math.round((size - STEP_REM) * 100) / 100;
        el.style.fontSize = `${size}rem`;
      }
      setFontSizeRem(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, enabled]);

  return { wrapRef, textRef, fontSizeRem };
}
