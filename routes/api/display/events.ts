import { define } from "../../../utils.ts";

function canViewDisplay(role: string | undefined): boolean {
  return role === "display_wall" || role === "moderator" || role === "admin";
}

export const handlers = define.handlers({
  GET(ctx) {
    const user = ctx.state.user;
    if (!user || !canViewDisplay(user.role)) {
      return new Response("Forbidden", { status: 403 });
    }
    const encoder = new TextEncoder();
    const unsubs: Array<() => void> = [];

    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        unsubs.push(
          ctx.state.services.photoWall.subscribeToApproved((submission) => {
            send("submission_approved", submission);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToEdited((submission) => {
            send("submission_edited", submission);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToDeleted((payload) => {
            send("submission_deleted", payload);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToTrainCommands((command) => {
            send("train_command", command);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToTrainPlaybackState((playback) => {
            send("train_playback_state", playback);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToDisplayOverride((command) => {
            send("display_override", command);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToSystemConfig((config) => {
            send("system_config_changed", config);
          }),
        );

        void ctx.state.services.photoWall.ensurePlaybackInitialized().then(() => {
          const playback = ctx.state.services.photoWall.getTrainPlaybackState();
          send("train_playback_state", {
            isPlaying: playback.isPlaying,
            currentCabin: playback.currentCabin,
            dwellSeconds: playback.dwellSeconds,
            lastTransitionAt: playback.lastTransitionAt,
          });
        });
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
