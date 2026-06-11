import { define } from "../../../utils.ts";

export const handlers = define.handlers({
  GET(ctx) {
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | undefined;

    const stream = new ReadableStream({
      start(controller) {
        unsubscribe = ctx.state.services.photoWall.subscribeToCreated((submission) => {
          const payload = `event: submission_created\ndata: ${JSON.stringify(submission)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        });
      },
      cancel() {
        unsubscribe?.();
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
