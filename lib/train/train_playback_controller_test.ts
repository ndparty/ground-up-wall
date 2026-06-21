import { assertEquals } from "@std/assert";
import type { TrainCommand } from "../interfaces/realtime_service.ts";
import { TrainPlaybackController } from "./train_playback_controller.ts";
import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER } from "./train_view_constants.ts";

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `c${i + 1}`);
}

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

function rightEdge(cmd: TrainCommand) {
  return cmd.window?.[cmd.window.length - 1];
}

Deno.test("initialize schedules tick when playing with cabins", () => {
  const harness = createTestController();
  harness.controller.initialize(15, ids(10));
  assertEquals(harness.scheduledDelay, 15_000);
  assertEquals(harness.controller.getState().currentCabin, 1);
  assertEquals(harness.controller.getState().window.length > 0, true);
});

Deno.test("advance emits next sequential post at right edge and moves center", () => {
  const { controller, published, fireScheduled } = createTestController();
  controller.initialize(10, ids(10));
  published.length = 0;

  fireScheduled();
  assertEquals(published.length, 1);
  const cmd = published[0];
  assertEquals(cmd.type, "advance");
  // Center was c1 (index 0); after one step it is c2.
  assertEquals(cmd.currentCabin, 2);
  assertEquals(controller.getState().currentCabin, 2);
  // Right edge is the newly generated sequential post.
  assertEquals(rightEdge(cmd)?.kind, "post");
  assertEquals(rightEdge(cmd)?.submissionId, "c6");
});

Deno.test("pause cancels scheduled tick and publishes pause", () => {
  const { controller, published, hasScheduled } = createTestController();
  controller.initialize(10, ids(3));
  published.length = 0;

  controller.handleUserCommand({ type: "pause" });
  assertEquals(published, [{ type: "pause" }]);
  assertEquals(hasScheduled(), false);
});

Deno.test("play resumes scheduling from full dwell", () => {
  const harness = createTestController();
  harness.controller.initialize(12, ids(3));
  harness.controller.handleUserCommand({ type: "pause" });
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "play" });
  assertEquals(harness.published, [{ type: "play" }]);
  assertEquals(harness.scheduledDelay, 12_000);
});

function expectedIdsAround(centerCabin: number, len: number): string[] {
  const centerIdx = centerCabin - 1;
  const ids: string[] = [];
  for (let off = -LEFT_RENDER; off <= RIGHT_RENDER; off++) {
    const idx = ((centerIdx + off) % len + len) % len;
    ids.push(`c${idx + 1}`);
  }
  return ids;
}

Deno.test("jump recenters the window and publishes target", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.advanceTime(4_000);
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.cabinNumber, 4);
  assertEquals(cmd.currentCabin, 4);
  assertEquals(harness.controller.getState().currentCabin, 4);
  assertEquals(harness.scheduledDelay, 10_000);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
});

Deno.test("in-chain jump publishes stepsToTarget without stepWindows", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  // Advance once so c2 is centered; c4 should still be in tape to the right.
  harness.fireScheduled();
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.stepWindows, undefined);
  assertEquals((cmd.stepsToTarget ?? 0) > 0, true);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
});

Deno.test("out-of-chain jump skips ephemeral queue during force-generate", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 8 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c8");

  // Preview was skipped during force-generate but restored for the next tick.
  harness.published.length = 0;
  harness.fireScheduled();
  assertEquals(rightEdge(harness.published[0])?.submissionId, "c10");
});

Deno.test("far jump rebuilds window with K cabins before and after target", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 9 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.currentCabin, 9);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c9");
  assertEquals(cmd.stepWindows, undefined);
  assertEquals((cmd.stepsToTarget ?? 0) > 0, true);

  const expected = expectedIdsAround(9, 10);
  const actual = cmd.window?.map((step) => step.submissionId) ?? [];
  assertEquals(actual, expected);
  assertEquals(actual[LEFT_RENDER], "c9");
});

Deno.test("setCabinIds clamps current cabin", () => {
  const { controller } = createTestController();
  controller.initialize(10, ids(5));
  controller.handleUserCommand({ type: "jump", cabinNumber: 5 });
  controller.setCabinIds(ids(2));
  assertEquals(controller.getState().currentCabin, 2);
});

Deno.test("setDwellSeconds reschedules with new dwell", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(2));
  harness.controller.setDwellSeconds(20);
  assertEquals(harness.scheduledDelay, 20_000);
});

Deno.test("zero cabins does not schedule", () => {
  const { controller, hasScheduled } = createTestController();
  controller.initialize(10, []);
  assertEquals(hasScheduled(), false);
  assertEquals(controller.getState().window.length, 0);
});

Deno.test("pauseForOverride cancels timer without changing isPlaying", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(3));
  assertEquals(harness.controller.getState().isPlaying, true);
  harness.controller.pauseForOverride();
  assertEquals(harness.hasScheduled(), false);
  assertEquals(harness.controller.getState().isPlaying, true);
});

Deno.test("resumeFromOverride reschedules when playing", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(3));
  harness.controller.pauseForOverride();
  harness.controller.resumeFromOverride();
  assertEquals(harness.scheduledDelay, 10_000);
});

Deno.test("enqueuePreview emits the preview ahead of the sequential post", () => {
  const { controller, published, fireScheduled } = createTestController();
  controller.initialize(10, ids(10));
  published.length = 0;

  controller.enqueuePreview("c10");
  fireScheduled();
  // The preview is emitted at the right edge instead of the next sequential cabin.
  assertEquals(rightEdge(published[0])?.kind, "post");
  assertEquals(rightEdge(published[0])?.submissionId, "c10");
});

Deno.test("qr interval enqueues a QR cabin every N emits (skip if already queued)", () => {
  const { controller, published, fireScheduled } = createTestController();
  controller.initialize(10, ids(10));
  controller.setQrInterval(2);
  published.length = 0;

  fireScheduled(); // emit 1 -> sequential
  assertEquals(rightEdge(published[0])?.kind, "post");
  fireScheduled(); // emit 2 -> QR enqueued and dequeued same tick
  assertEquals(rightEdge(published[1])?.kind, "qr");
});

Deno.test("restoreFromSnapshot resumes playback after restart", () => {
  const harness = createTestController();
  harness.controller.initialize(15, ids(10));
  const snapshot = harness.controller.exportSnapshot();
  harness.controller.handleUserCommand({ type: "pause" });

  const restarted = createTestController();
  const restored = restarted.controller.restoreFromSnapshot(snapshot, ids(10));
  assertEquals(restored, true);
  assertEquals(restarted.controller.getState().currentCabin, snapshot.currentCabin);
  assertEquals(restarted.controller.getState().window.length, snapshot.window.length);
});

Deno.test("restoreFromSnapshot rejects when window references deleted cabin", () => {
  const harness = createTestController();
  harness.controller.initialize(15, ids(10));
  const snapshot = harness.controller.exportSnapshot();

  const restarted = createTestController();
  const restored = restarted.controller.restoreFromSnapshot(snapshot, ids(9));
  assertEquals(restored, false);
});
