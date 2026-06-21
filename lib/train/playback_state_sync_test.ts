import { assertEquals } from "@std/assert";
import { shouldApplyPlaybackStateWindow } from "./playback_state_sync.ts";

Deno.test("shouldApplyPlaybackStateWindow false while advances are queued", () => {
  assertEquals(shouldApplyPlaybackStateWindow(1), false);
  assertEquals(shouldApplyPlaybackStateWindow(3), false);
});

Deno.test("shouldApplyPlaybackStateWindow true when idle", () => {
  assertEquals(shouldApplyPlaybackStateWindow(0), true);
});
