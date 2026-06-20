import { assertEquals } from "@std/assert";
import { BASE_SLIDE_MS, slideDurationMs, SLIDE_MAX_FACTOR, S_MAX } from "./slide_duration.ts";

Deno.test("slideDurationMs base for one step", () => {
  assertEquals(slideDurationMs(1), BASE_SLIDE_MS);
});

Deno.test("slideDurationMs scales to max factor at S_MAX", () => {
  assertEquals(slideDurationMs(S_MAX), BASE_SLIDE_MS * SLIDE_MAX_FACTOR);
});

Deno.test("slideDurationMs clamps high step counts", () => {
  assertEquals(slideDurationMs(100), slideDurationMs(S_MAX));
});
