import { define } from "../../../utils.ts";
import { createSseResponse } from "../../../lib/sse/create_event_stream.ts";

function canViewDisplay(role: string | undefined): boolean {
  return role === "display_wall" || role === "moderator" || role === "admin";
}

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user || !canViewDisplay(user.role)) {
      return new Response("Forbidden", { status: 403 });
    }

    return createSseResponse((send, registerCleanup) => {
      const photoWall = ctx.state.services.photoWall;

      registerCleanup(
        photoWall.subscribeToApproved((submission) => {
          send.send("submission_approved", submission);
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
      registerCleanup(
        photoWall.subscribeToTrainCommands((command) => {
          send.send("train_command", command);
        }),
      );
      registerCleanup(
        photoWall.subscribeToTrainPlaybackState((playback) => {
          send.send("train_playback_state", playback);
        }),
      );
      registerCleanup(
        photoWall.subscribeToDisplayOverride((command) => {
          send.send("display_override", command);
        }),
      );
      registerCleanup(
        photoWall.subscribeToDisplayReload(() => {
          send.send("display_reload", {});
        }),
      );
      registerCleanup(
        photoWall.subscribeToSystemConfig((config) => {
          send.send("system_config_changed", config);
        }),
      );

      void photoWall.ensurePlaybackInitialized()
        .then(() => {
          if (send.isClosed()) return;
          const playback = photoWall.getTrainPlaybackState();
          send.send("train_playback_state", {
            isPlaying: playback.isPlaying,
            currentCabin: playback.currentCabin,
            dwellSeconds: playback.dwellSeconds,
            lastTransitionAt: playback.lastTransitionAt,
            window: playback.window,
          });
        })
        .catch((err) => {
          console.error("display/events: ensurePlaybackInitialized failed", err);
        });
    });
  },
});
