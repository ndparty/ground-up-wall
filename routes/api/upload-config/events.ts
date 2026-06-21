import { define } from "../../../utils.ts";

// Public SSE stream of upload-relevant system config changes (FR-13a live reload).
// No auth: the upload form is public; only non-sensitive prompt/length config is sent.
const UPLOAD_CONFIG_KEYS = new Set([
  "message_prompt_text",
  "message_length_limit",
  "message_length_unit",
]);

export const handlers = define.handlers({
  GET(ctx) {
    const encoder = new TextEncoder();
    const unsubs: Array<() => void> = [];

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(": connected\n\n"));
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        unsubs.push(
          ctx.state.services.photoWall.subscribeToSystemConfig((config) => {
            if (UPLOAD_CONFIG_KEYS.has(config.key)) {
              send("system_config_changed", { key: config.key, value: config.value });
            }
          }),
        );
      },
      cancel() {
        for (const unsub of unsubs) unsub();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
});
