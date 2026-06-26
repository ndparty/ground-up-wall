import { define } from "../../../utils.ts";
import { createSseResponse } from "../../../lib/sse/create_event_stream.ts";

// Public SSE stream of upload-relevant system config changes (FR-13a live reload).
// No auth: the upload form is public; only non-sensitive prompt/length config is sent.
const UPLOAD_CONFIG_KEYS = new Set([
  "message_prompt_text",
  "message_length_limit",
  "message_length_unit",
]);

export const handlers = define.handlers({
  GET(ctx) {
    return createSseResponse((send, registerCleanup) => {
      registerCleanup(
        ctx.state.services.photoWall.subscribeToSystemConfig((config) => {
          if (UPLOAD_CONFIG_KEYS.has(config.key)) {
            send.send("system_config_changed", { key: config.key, value: config.value });
          }
        }),
      );
    });
  },
});
