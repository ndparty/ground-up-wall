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

  const background = isReconnecting ? "#f57c00" : status === "offline" ? "#c62828" : "#2e7d32";

  return (
    <div
      role="status"
      aria-live="polite"
      style={`position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999; padding: 0.5rem 1rem; text-align: center; color: white; font-size: 0.95rem; background: ${background};`}
    >
      {message}
    </div>
  );
}
