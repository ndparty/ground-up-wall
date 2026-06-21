import { assertEquals } from "@std/assert";
import { createSseResponse } from "./create_event_stream.ts";

Deno.test("createSseResponse send returns false after stream cancel", async () => {
  let send!: (event: string, data: unknown) => boolean;

  const res = createSseResponse((handle) => {
    send = handle.send;
  });

  const reader = res.body!.getReader();
  await reader.read();
  await reader.cancel();

  assertEquals(send("test", { ok: true }), false);
});

Deno.test("createSseResponse late async send does not throw after cancel", async () => {
  let send!: (event: string, data: unknown) => boolean;

  const res = createSseResponse((handle) => {
    send = handle.send;
    queueMicrotask(() => {
      send("late", { value: 1 });
    });
  });

  const reader = res.body!.getReader();
  await reader.read();
  await reader.cancel();

  assertEquals(send("late", { value: 2 }), false);
});
