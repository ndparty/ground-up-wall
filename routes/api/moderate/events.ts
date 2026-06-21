import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const encoder = new TextEncoder();
    const unsubs: Array<() => void> = [];

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(": connected\n\n"));
        const send = (event: string, data: unknown) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        unsubs.push(
          ctx.state.services.photoWall.subscribeToCreated((submission) => {
            send("submission_created", submission);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToApproved((submission) => {
            send("submission_approved", submission);
          }),
        );
        unsubs.push(
          ctx.state.services.photoWall.subscribeToRejected((payload) => {
            send("submission_rejected", payload);
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
