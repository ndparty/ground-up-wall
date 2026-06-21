import { assertEquals } from "@std/assert";
import {
  BASE_SLIDE_MS,
  JUMP_BASE_MS,
  JUMP_MAX_MS,
  JUMP_MAX_STEPS,
  jumpSlideDurationMs,
  slideDurationMs,
  SLIDE_MAX_FACTOR,
  S_MAX,
} from "./slide_duration.ts";

Deno.test("slideDurationMs base for one step", () => {
  assertEquals(slideDurationMs(1), BASE_SLIDE_MS);
});

Deno.test("slideDurationMs scales to max factor at S_MAX", () => {
  assertEquals(slideDurationMs(S_MAX), BASE_SLIDE_MS * SLIDE_MAX_FACTOR);
});

Deno.test("slideDurationMs clamps high step counts", () => {
  assertEquals(slideDurationMs(100), slideDurationMs(S_MAX));
});

Deno.test("jumpSlideDurationMs is 800ms at 1 step", () => {
  assertEquals(jumpSlideDurationMs(1), JUMP_BASE_MS);
});

Deno.test("jumpSlideDurationMs is 3000ms at 9 steps", () => {
  assertEquals(jumpSlideDurationMs(JUMP_MAX_STEPS), JUMP_MAX_MS);
});

Deno.test("jumpSlideDurationMs is linear at mid-point", () => {
  assertEquals(jumpSlideDurationMs(5), 1900);
});
