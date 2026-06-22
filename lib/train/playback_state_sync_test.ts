import { assertEquals } from "@std/assert";
import { shouldApplyPlaybackStateWindow } from "./playback_state_sync.ts";

Deno.test("shouldApplyPlaybackStateWindow false while advances are queued", () => {
  assertEquals(shouldApplyPlaybackStateWindow(1, false, false), false);
  assertEquals(shouldApplyPlaybackStateWindow(3, false, false), false);
});

Deno.test("shouldApplyPlaybackStateWindow false while orchestrator busy", () => {
  assertEquals(shouldApplyPlaybackStateWindow(0, true, false), false);
  assertEquals(shouldApplyPlaybackStateWindow(1, true, false), false);
});

Deno.test("shouldApplyPlaybackStateWindow false while deferred jump pending", () => {
  assertEquals(shouldApplyPlaybackStateWindow(0, false, true), false);
  assertEquals(shouldApplyPlaybackStateWindow(0, true, true), false);
});

Deno.test("shouldApplyPlaybackStateWindow true when fully idle", () => {
  assertEquals(shouldApplyPlaybackStateWindow(0, false, false), true);
});
