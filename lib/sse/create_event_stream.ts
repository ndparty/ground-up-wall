export interface SseStreamHandle {
  send: (event: string, data: unknown) => boolean;
  isClosed: () => boolean;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

/**
 * ReadableStream SSE response with guarded enqueue so late async callbacks
 * cannot crash the process after the client disconnects.
 */
export function createSseResponse(
  setup: (
    handle: SseStreamHandle,
    registerCleanup: (fn: () => void) => void,
  ) => void,
): Response {
  const encoder = new TextEncoder();
  const cleanups: Array<() => void> = [];
  let closed = false;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const handle: SseStreamHandle = {
    send(event: string, data: unknown): boolean {
      if (closed || controller === null) return false;
      try {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
        return true;
      } catch {
        closed = true;
        return false;
      }
    },
    isClosed(): boolean {
      return closed;
    },
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      try {
        controller.enqueue(encoder.encode(": connected\n\n"));
      } catch {
        closed = true;
        return;
      }
      setup(handle, (fn) => cleanups.push(fn));
    },
    cancel() {
      closed = true;
      for (const fn of cleanups) fn();
      cleanups.length = 0;
      try {
        controller?.close();
      } catch {
        // stream may already be closed
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
