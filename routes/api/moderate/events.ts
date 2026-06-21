import { define } from "../../../utils.ts";
import { createSseResponse } from "../../../lib/sse/create_event_stream.ts";

export const handlers = define.handlers({
  GET(ctx) {
    return createSseResponse((send, registerCleanup) => {
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
