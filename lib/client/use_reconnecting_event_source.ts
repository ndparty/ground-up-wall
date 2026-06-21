import { type RefObject, useEffect, useRef, useState } from "preact/hooks";

const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const BACKOFF_FACTOR = 2;

export type ConnectionStatus = "live" | "reconnecting" | "offline";

export interface ReconnectingEventSourceOptions {
  enabled?: boolean;
  onReconnect?: () => void;
}

/**
 * EventSource wrapper with exponential backoff reconnect.
 * Handlers are read from a ref so callers can update them without reconnecting.
 */
export function useReconnectingEventSource(
  url: string,
  handlersRef: RefObject<Record<string, (event: MessageEvent) => void>>,
  options?: ReconnectingEventSourceOptions,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("live");
  const onReconnectRef = useRef(options?.onReconnect);
  onReconnectRef.current = options?.onReconnect;
  const enabled = options?.enabled ?? true;
  const hadConnectedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setStatus("live");
      return;
    }

    let closed = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delayMs = INITIAL_DELAY_MS;
    let awaitingReconnect = false;

    function handleOpen(): void {
      delayMs = INITIAL_DELAY_MS;
      setStatus("live");
      if (awaitingReconnect) {
        onReconnectRef.current?.();
      }
      awaitingReconnect = false;
      hadConnectedRef.current = true;
    }

    function attachHandlers(source: EventSource): void {
      const handlers = handlersRef.current ?? {};
      for (const [type, handler] of Object.entries(handlers)) {
        source.addEventListener(type, (event) => {
          setStatus("live");
          handler(event as MessageEvent);
        });
      }
    }

    function detachHandlers(source: EventSource): void {
      const handlers = handlersRef.current ?? {};
      for (const [type, handler] of Object.entries(handlers)) {
        source.removeEventListener(type, handler);
      }
    }

    function scheduleReconnect(): void {
      if (closed) return;
      awaitingReconnect = hadConnectedRef.current;
      setStatus("reconnecting");
      reconnectTimer = setTimeout(() => {
        delayMs = Math.min(delayMs * BACKOFF_FACTOR, MAX_DELAY_MS);
        connect();
      }, delayMs);
    }

    function connect(): void {
      if (closed) return;
      es = new EventSource(url);
      attachHandlers(es);

      es.addEventListener("open", () => {
        handleOpen();
      });

      es.onerror = () => {
        const source = es;
        if (!source || closed) return;

        // Firefox may fire error while the stream is still open or connecting.
        // Only replace the connection once the browser has closed it.
        if (source.readyState === EventSource.OPEN) return;
        if (source.readyState === EventSource.CONNECTING) {
          setStatus("reconnecting");
          return;
        }

        detachHandlers(source);
        source.close();
        es = null;
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      closed = true;
      setStatus("live");
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (es) {
        detachHandlers(es);
        es.close();
        es = null;
      }
    };
  }, [url, enabled]);

  return status;
}
