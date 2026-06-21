import { useEffect, useRef, useState } from "preact/hooks";
import type { ConnectionStatus } from "../lib/client/use_reconnecting_event_source.ts";

interface ConnectionBannerProps {
  status: ConnectionStatus;
}

export default function ConnectionBanner({ status }: ConnectionBannerProps) {
  const [showBackOnline, setShowBackOnline] = useState(false);
  const prevStatusRef = useRef<ConnectionStatus>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev !== "live" && status === "live") {
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(timer);
    }
    if (status !== "live") {
      setShowBackOnline(false);
    }
  }, [status]);

  if (status === "live" && !showBackOnline) return null;

  const isReconnecting = status === "reconnecting";
  const message = isReconnecting
    ? "Reconnecting…"
    : status === "offline"
    ? "Connection lost"
    : "Back online";

  const bannerClass = isReconnecting
    ? "connection-banner connection-banner--reconnecting"
    : status === "offline"
    ? "connection-banner connection-banner--offline"
    : "connection-banner connection-banner--online";

  return (
    <div
      role="status"
      aria-live="polite"
      class={bannerClass}
    >
      {message}
    </div>
  );
}
