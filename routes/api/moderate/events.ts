import { define } from "../../../utils.ts";
import { createSseResponse } from "../../../lib/sse/create_event_stream.ts";
import { acquireConnection, releaseConnection } from "../../../lib/sse/connection_limit.ts";

const MAX_SSE_CONNECTIONS = 50;

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    const connKey = `moderate:${user?.id ?? "anon"}`;
    if (!acquireConnection(connKey, MAX_SSE_CONNECTIONS)) {
      return new Response("Too many connections", { status: 503 });
    }

    return createSseResponse((send, registerCleanup) => {
      registerCleanup(() => releaseConnection(connKey));
      const photoWall = ctx.state.services.photoWall;

      registerCleanup(
        photoWall.subscribeToCreated((submission) => {
          send.send("submission_created", submission);
        }),
      );
      registerCleanup(
        photoWall.subscribeToApproved((submission) => {
          send.send("submission_approved", submission);
        }),
      );
      registerCleanup(
        photoWall.subscribeToRejected((payload) => {
          send.send("submission_rejected", payload);
        }),
      );
      registerCleanup(
        photoWall.subscribeToEdited((submission) => {
          send.send("submission_edited", submission);
        }),
      );
      registerCleanup(
        photoWall.subscribeToDeleted((payload) => {
          send.send("submission_deleted", payload);
        }),
      );
    });
  },
});
