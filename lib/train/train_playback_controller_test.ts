import { assertEquals } from "@std/assert";
import type { TrainCommand } from "../interfaces/realtime_service.ts";
import { TrainPlaybackController } from "./train_playback_controller.ts";

function createTestController(initialNow = 1_000) {
  let now = initialNow;
  let scheduledDelay = -1;
  let scheduledFn: (() => void) | null = null;
  const published: TrainCommand[] = [];

  const controller = new TrainPlaybackController({
    publish: (cmd) => published.push(cmd),
    now: () => now,
    schedule: (fn, delayMs) => {
      scheduledFn = fn;
      scheduledDelay = delayMs;
    },
    cancelSchedule: () => {
      scheduledFn = null;
      scheduledDelay = -1;
    },
  });

  return {
    controller,
    published,
    advanceTime(ms: number) {
      now += ms;
    },
    fireScheduled() {
      const fn = scheduledFn;
      scheduledFn = null;
      scheduledDelay = -1;
      fn?.();
    },
    get scheduledDelay() {
      return scheduledDelay;
    },
    hasScheduled() {
      return scheduledFn !== null;
    },
  };
}

Deno.test("initialize schedules tick when playing with cabins", () => {
  const harness = createTestController();
  harness.controller.initialize(15, 3);
  assertEquals(harness.scheduledDelay, 15_000);
});

Deno.test("advance wraps cabin count and publishes advance command", () => {
  const { controller, published, fireScheduled } = createTestController();
  controller.initialize(10, 3);
  controller.handleUserCommand({ type: "jump", cabinNumber: 3 });
  published.length = 0;

  fireScheduled();
  assertEquals(published, [{ type: "advance", cabinNumber: 1 }]);
  assertEquals(controller.getState().currentCabin, 1);
});

Deno.test("pause cancels scheduled tick and publishes pause", () => {
  const { controller, published, hasScheduled } = createTestController();
  controller.initialize(10, 2);
  published.length = 0;

  controller.handleUserCommand({ type: "pause" });
  assertEquals(published, [{ type: "pause" }]);
  assertEquals(hasScheduled(), false);
});

Deno.test("play resumes scheduling from full dwell", () => {
  const harness = createTestController();
  harness.controller.initialize(12, 2);
  harness.controller.handleUserCommand({ type: "pause" });
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "play" });
  assertEquals(harness.published, [{ type: "play" }]);
  assertEquals(harness.scheduledDelay, 12_000);
});

Deno.test("jump resets dwell timer and publishes cabin", () => {
  const harness = createTestController();
  harness.controller.initialize(10, 5);
  harness.advanceTime(4_000);
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  assertEquals(harness.published, [{ type: "jump", cabinNumber: 4 }]);
  assertEquals(harness.scheduledDelay, 10_000);
});

Deno.test("setCabinCount clamps current cabin", () => {
  const { controller } = createTestController();
  controller.initialize(10, 5);
  controller.handleUserCommand({ type: "jump", cabinNumber: 5 });
  controller.setCabinCount(2);
  assertEquals(controller.getState().currentCabin, 2);
});

Deno.test("setDwellSeconds reschedules with new dwell", () => {
  const harness = createTestController();
  harness.controller.initialize(10, 2);
  harness.controller.setDwellSeconds(20);
  assertEquals(harness.scheduledDelay, 20_000);
});

Deno.test("zero cabins does not schedule", () => {
  const { controller, hasScheduled } = createTestController();
  controller.initialize(10, 0);
  assertEquals(hasScheduled(), false);
});

Deno.test("pauseForOverride cancels timer without changing isPlaying", () => {
  const harness = createTestController();
  harness.controller.initialize(10, 3);
  assertEquals(harness.controller.getState().isPlaying, true);
  harness.controller.pauseForOverride();
  assertEquals(harness.hasScheduled(), false);
  assertEquals(harness.controller.getState().isPlaying, true);
});

Deno.test("resumeFromOverride reschedules when playing", () => {
  const harness = createTestController();
  harness.controller.initialize(10, 3);
  harness.controller.pauseForOverride();
  harness.controller.resumeFromOverride();
  assertEquals(harness.scheduledDelay, 10_000);
});
