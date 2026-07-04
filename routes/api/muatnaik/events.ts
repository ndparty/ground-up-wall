import { define } from "../../../utils.ts";
import { createSseResponse } from "../../../lib/sse/create_event_stream.ts";
import { acquireConnection, releaseConnection } from "../../../lib/sse/connection_limit.ts";
import { clientKey } from "../../../lib/security/rate_limit.ts";

// Public SSE stream of upload-relevant system config changes (FR-13a live reload).
// No auth: the upload form is public; only non-sensitive prompt/length config is sent.
const UPLOAD_CONFIG_KEYS = new Set([
  "message_prompt_text",
  "message_length_limit",
  "message_length_unit",
]);

// Anonymous per-IP connection ceiling so the unauthenticated stream cannot be
// used to exhaust server connections (NFR-23).
const MAX_ANON_UPLOAD_SSE = 10;

export const handlers = define.handlers({
  GET(ctx) {
    const connKey = `muatnaik:${clientKey(ctx.req, ctx.info)}`;
    if (!acquireConnection(connKey, MAX_ANON_UPLOAD_SSE)) {
      return new Response("Too many connections", { status: 503 });
    }
    return createSseResponse((send, registerCleanup) => {
      registerCleanup(() => releaseConnection(connKey));
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
