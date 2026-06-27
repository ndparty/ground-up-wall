import { useEffect, useRef } from "preact/hooks";

/** Display-only: roll session while SSE runs with cached images and no new img requests. */
export const DISPLAY_SESSION_KEEPALIVE_MS = 45 * 60 * 1000;

export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  window.location.assign("/masuk");
}

/**
 * Poll /api/masuk/me so idle display walls refresh their session before expiry.
 * On 401, redirect to login (images would 401 while SSE still streams).
 */
export function useDisplaySessionKeepalive(enabled: boolean): void {
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function keepalive(): Promise<void> {
      try {
        const res = await fetch("/api/masuk/me", { credentials: "same-origin" });
        if (cancelled || redirectingRef.current) return;
        if (res.status === 401) {
          redirectingRef.current = true;
          redirectToLogin();
        }
      } catch {
        // Network errors are handled by the SSE connection banner.
      }
    }

    const id = setInterval(() => void keepalive(), DISPLAY_SESSION_KEEPALIVE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);
}
