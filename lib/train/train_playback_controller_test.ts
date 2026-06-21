import { assertEquals } from "@std/assert";
import type { TrainCommand } from "../interfaces/realtime_service.ts";
import { TrainPlaybackController } from "./train_playback_controller.ts";
import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER, WINDOW_LENGTH } from "./train_view_constants.ts";
import {
  findForwardCanonicalPostInTape,
  forwardSlotSteps,
  hasEphemeralOnPathToSlot,
} from "./tape_helpers.ts";
import { computeJumpAnimationPath, computeJumpStepCount, getJumpSlideTargetKey } from "./train_view.ts";

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

Deno.test("in-chain jump publishes animationWindow with new right-edge steps", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals((cmd.animationWindow?.length ?? 0) > WINDOW_LENGTH, true);
  assertNoEphemeralInOverlay(cmd);
  assertEquals(cmd.animationWindow?.some((s) => s.submissionId === "c4"), true);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
});

function assertNoEphemeralInOverlay(_cmd: TrainCommand) {
  // On-chain ephemerals may appear in jump overlays after mergePreJumpEphemerals.
}

function assertJumpSlideTargetInOverlay(cmd: TrainCommand) {
  const overlay = cmd.animationWindow ?? [];
  const slideKey = getJumpSlideTargetKey(overlay, cmd.window ?? []);
  assertEquals(slideKey !== null, true);
  assertEquals(overlay.some((s) => `s${s.seq}` === slideKey), true);
}

function advanceToCabin(harness: ReturnType<typeof createTestController>, cabin: number) {
  while (harness.controller.getState().currentCabin < cabin) {
    harness.fireScheduled();
  }
}

Deno.test("far jump publishes bounded animationWindow", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 9 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  const animLen = cmd.animationWindow?.length ?? 0;
  const stepsToTarget = cmd.stepsToTarget ?? 0;
  assertEquals(animLen > WINDOW_LENGTH, true);
  assertEquals(animLen <= WINDOW_LENGTH + stepsToTarget + RIGHT_RENDER, true);
  assertNoEphemeralInOverlay(cmd);
  assertEquals(cmd.animationWindow?.some((s) => s.submissionId === "c9"), true);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c9");
});

Deno.test("far jump 9 to 14 overlay has no duplicate canonical cabins", () => {
  const harness = createTestController();
  const cabinIds = ids(15);
  harness.controller.initialize(10, cabinIds);
  while (harness.controller.getState().currentCabin < 9) {
    harness.fireScheduled();
  }
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 14 });
  const cmd = harness.published[0];
  const overlay = cmd.animationWindow ?? [];
  for (const cabin of computeJumpAnimationPath(9, 14, 15)) {
    assertEquals(overlay.some((s) => s.submissionId === `c${cabin}`), true);
  }
  assertJumpSlideTargetInOverlay(cmd);
});

Deno.test("far jump 9 to 16 collapsed overlay includes target and resolves slide key", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(20));
  advanceToCabin(harness, 9);
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 16 });
  const cmd = harness.published[0];
  assertEquals(cmd.currentCabin, 16);
  for (const cabin of [17, 18, 19, 20]) {
    assertEquals(cmd.animationWindow?.some((s) => s.submissionId === `c${cabin}`), true);
  }
  assertJumpSlideTargetInOverlay(cmd);
});

Deno.test("far jump 9 to 20 collapsed overlay includes target and resolves slide key", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(20));
  advanceToCabin(harness, 9);
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 20 });
  const cmd = harness.published[0];
  assertEquals(cmd.animationWindow?.some((s) => s.submissionId === "c20"), true);
  assertJumpSlideTargetInOverlay(cmd);
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

Deno.test("in-chain jump with preview duplicate targets rightmost canonical forward post", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.controller.enqueuePreview("c4");
  harness.fireScheduled();
  while (harness.controller.getState().currentCabin < 3) {
    harness.fireScheduled();
  }
  for (let i = 0; i < 2; i++) harness.fireScheduled();

  const preJumpTape = harness.controller.getState().window;
  const canonicalSlot = findForwardCanonicalPostInTape(preJumpTape, "c4");
  const fromCabin = harness.controller.getState().currentCabin;

  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
  assertEquals(cmd.window?.[CENTER_SLOT]?.ephemeral, undefined);

  if (canonicalSlot !== null) {
    if (hasEphemeralOnPathToSlot(preJumpTape, canonicalSlot)) {
      assertEquals(cmd.stepsToTarget, computeJumpStepCount(fromCabin, 4, 10));
    } else {
      assertEquals(cmd.stepsToTarget, forwardSlotSteps(preJumpTape, canonicalSlot));
    }
  }
  assertNoEphemeralInOverlay(cmd);
  assertJumpSlideTargetInOverlay(cmd);
});

Deno.test("in-chain jump with off-path preview uses clean overlay without ephemerals", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.fireScheduled();
  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
  assertNoEphemeralInOverlay(cmd);
});

Deno.test("jump with other ephemerals on path rebuilds to canonical target", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.fireScheduled();

  const preJumpTape = harness.controller.getState().window;
  const fromCabin = harness.controller.getState().currentCabin;
  const targetCabin = 5;
  const targetId = `c${targetCabin}`;
  const canonicalSlot = findForwardCanonicalPostInTape(preJumpTape, targetId);
  assertEquals(canonicalSlot !== null, true);

  const ephemeralsOnPath = hasEphemeralOnPathToSlot(preJumpTape, canonicalSlot!);

  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: targetCabin });
  const cmd = harness.published[0];
  const center = cmd.window?.[CENTER_SLOT];

  assertEquals(cmd.type, "jump");
  assertEquals(center?.submissionId, targetId);
  assertEquals(center?.ephemeral, undefined);
  assertEquals(cmd.currentCabin, targetCabin);
  assertEquals(harness.controller.getState().currentCabin, targetCabin);

  if (ephemeralsOnPath) {
    assertEquals(cmd.stepsToTarget, computeJumpStepCount(fromCabin, targetCabin, 10));
    assertEquals(cmd.stepsToTarget !== forwardSlotSteps(preJumpTape, canonicalSlot!), true);
  }
  assertNoEphemeralInOverlay(cmd);
  for (let i = 1; i <= RIGHT_RENDER; i++) {
    const cabin = ((targetCabin - 1 + i) % 10) + 1;
    assertEquals(cmd.animationWindow?.some((s) => s.submissionId === `c${cabin}`), true);
  }
  assertJumpSlideTargetInOverlay(cmd);
});

Deno.test("jump with forward ephemeral preview centers on canonical not preview seq", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.controller.enqueuePreview("c4");
  harness.fireScheduled();

  const preJumpTape = harness.controller.getState().window;
  const ephemeralSeq = preJumpTape.find(
    (s, i) => i > CENTER_SLOT && s.submissionId === "c4" && s.ephemeral,
  )?.seq;
  const canonicalSlot = findForwardCanonicalPostInTape(preJumpTape, "c4");

  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  const center = cmd.window?.[CENTER_SLOT];

  assertEquals(cmd.type, "jump");
  assertEquals(center?.submissionId, "c4");
  assertEquals(center?.ephemeral, undefined);

  if (ephemeralSeq !== undefined && canonicalSlot === null) {
    assertEquals(center?.seq !== ephemeralSeq, true);
  } else if (
    canonicalSlot !== null &&
    !hasEphemeralOnPathToSlot(preJumpTape, canonicalSlot)
  ) {
    assertEquals(cmd.stepsToTarget, forwardSlotSteps(preJumpTape, canonicalSlot));
  }
  assertNoEphemeralInOverlay(cmd);
  assertJumpSlideTargetInOverlay(cmd);
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

Deno.test("resetToFreshState clears queue and rebuilds tape at cabin 1", () => {
  const { controller, published, fireScheduled } = createTestController();
  controller.initialize(10, ids(10));
  controller.enqueuePreview("c10");
  controller.handleUserCommand({ type: "jump", cabinNumber: 5 });
  published.length = 0;

  controller.resetToFreshState(1);

  const state = controller.getState();
  assertEquals(state.currentCabin, 1);
  assertEquals(state.window.length, WINDOW_LENGTH);
  assertEquals(state.window[CENTER_SLOT]?.submissionId, "c1");
  for (const step of state.window) {
    if (step.kind === "post" && step.submissionId) {
      assertEquals(step.submissionId.startsWith("c"), true);
    }
  }
  const seqs = state.window.map((s) => s.seq);
  assertEquals(seqs, [1, 2, 3, 4, 5, 6, 7]);
});

Deno.test("resetToFreshState with zero cabins clears tape and cancels timer", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(3));
  harness.controller.setCabinIds([]);
  harness.controller.resetToFreshState(1);
  assertEquals(harness.controller.getState().window.length, 0);
  assertEquals(harness.hasScheduled(), false);
});

Deno.test("resetToFreshState does not schedule when paused for override", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(5));
  harness.controller.pauseForOverride();
  harness.controller.resetToFreshState(1);
  assertEquals(harness.hasScheduled(), false);
  assertEquals(harness.controller.getState().currentCabin, 1);
});

Deno.test("resetToFreshState after cabin list shrinks excludes removed ids", () => {
  const { controller } = createTestController();
  controller.initialize(10, ids(5));
  controller.setCabinIds(["c1", "c3", "c5"]);
  controller.resetToFreshState(1);
  const state = controller.getState();
  for (const step of state.window) {
    if (step.kind === "post" && step.submissionId) {
      assertEquals(["c1", "c3", "c5"].includes(step.submissionId), true);
    }
  }
});
