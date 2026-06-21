import { assertEquals } from "@std/assert";
import { MemoryRealtimeService } from "./memory_realtime_service.ts";

Deno.test("testPublishSubscribe", async () => {
  const realtime = new MemoryRealtimeService();
  let received: unknown;
  realtime.subscribe("test:channel", (payload) => {
    received = payload;
  });
  await realtime.publish("test:channel", { hello: "world" });
  assertEquals(received, { hello: "world" });
});

Deno.test("testUnsubscribe", async () => {
  const realtime = new MemoryRealtimeService();
  let callCount = 0;
  const unsub = realtime.subscribe("test:channel", () => {
    callCount++;
  });
  await realtime.publish("test:channel", {});
  unsub();
  await realtime.publish("test:channel", {});
  assertEquals(callCount, 1);
});

Deno.test("testMultipleSubscribers", async () => {
  const realtime = new MemoryRealtimeService();
  let count1 = 0;
  let count2 = 0;
  realtime.subscribe("test:channel", () => count1++);
  realtime.subscribe("test:channel", () => count2++);
  await realtime.publish("test:channel", {});
  assertEquals(count1, 1);
  assertEquals(count2, 1);
});
