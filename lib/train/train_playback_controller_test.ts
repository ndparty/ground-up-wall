import { assertEquals } from "@std/assert";
import type { TrainCommand, TrainStep } from "../interfaces/realtime_service.ts";
import { TrainPlaybackController } from "./train_playback_controller.ts";
import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER, WINDOW_LENGTH } from "./train_view_constants.ts";

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

Deno.test("in-chain jump publishes committed window without stepWindows", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.stepWindows, undefined);
  assertEquals(cmd.animationWindow, undefined);
  assertEquals(cmd.stepsToTarget, undefined);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
});

Deno.test("long jump with queued preview leaves queue untouched (J-E1)", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  const preJump = harness.controller.getState().window;
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 8 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c8");
  assertEquals(
    cmd.window?.some((s) => s.submissionId === "c10" && s.ephemeral),
    false,
  );
  assertEquals(preJump.length > 0, true);
});

Deno.test("short jump buffer fill may emit queued preview (J-E2)", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
  assertEquals(
    cmd.window?.some((s) => s.submissionId === "c10" && s.ephemeral),
    true,
  );
});

Deno.test("jump on-tape left of center uses long forward steps J-N5", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  while (harness.controller.getState().currentCabin < 5) {
    harness.fireScheduled();
  }
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
});

Deno.test("jump to current cabin at center publishes zero-step jump SSE", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  while (harness.controller.getState().currentCabin < 5) {
    harness.fireScheduled();
  }
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 5 });
  assertEquals(harness.published.length, 1);
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.cabinNumber, 5);
  assertEquals(harness.controller.getState().currentCabin, 5);
});

Deno.test("far jump c2 to c9 does not ring-walk every cabin", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 9 });
  const cmd = harness.published[0];
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c9");
});

Deno.test("in-chain jump publishes window with target centered", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.length, WINDOW_LENGTH);
  assertEquals(cmd.window?.some((s) => s.submissionId === "c4"), true);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
});

function advanceToCabin(harness: ReturnType<typeof createTestController>, cabin: number) {
  while (harness.controller.getState().currentCabin < cabin) {
    harness.fireScheduled();
  }
}

Deno.test("far jump publishes committed window centered on target", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 9 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.length, WINDOW_LENGTH);
  assertEquals(cmd.window?.some((s) => s.submissionId === "c9"), true);
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c9");
});

Deno.test("far jump 9 to 14 window includes neighborhood around target", () => {
  const harness = createTestController();
  const cabinIds = ids(15);
  harness.controller.initialize(10, cabinIds);
  while (harness.controller.getState().currentCabin < 9) {
    harness.fireScheduled();
  }
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 14 });
  const cmd = harness.published[0];
  const window = cmd.window ?? [];
  for (const cabin of expectedIdsAround(14, 15)) {
    assertEquals(window.some((s) => s.submissionId === cabin), true);
  }
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c14");
});

Deno.test("far jump 9 to 16 window includes forward buffer cabins", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(20));
  advanceToCabin(harness, 9);
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 16 });
  const cmd = harness.published[0];
  assertEquals(cmd.currentCabin, 16);
  for (const cabin of [17, 18, 19, 20]) {
    assertEquals(cmd.window?.some((s) => s.submissionId === `c${cabin}`), true);
  }
});

Deno.test("far jump 9 to 20 window centers on target", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(20));
  advanceToCabin(harness, 9);
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 20 });
  const cmd = harness.published[0];
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c20");
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

  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
  assertEquals(cmd.window?.[CENTER_SLOT]?.ephemeral, undefined);
});

Deno.test("in-chain jump with off-path preview commits canonical center", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.fireScheduled();
  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.window?.[CENTER_SLOT]?.submissionId, "c4");
  assertEquals(cmd.window?.[CENTER_SLOT]?.ephemeral, undefined);
});

Deno.test("jump with on-chain ephemeral keeps prefix and reaches canonical target", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.fireScheduled();

  const targetCabin = 5;

  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: targetCabin });
  const cmd = harness.published[0];
  const center = cmd.window?.[CENTER_SLOT];

  assertEquals(cmd.type, "jump");
  assertEquals(center?.submissionId, `c${targetCabin}`);
  assertEquals(center?.ephemeral, undefined);
  assertEquals(cmd.currentCabin, targetCabin);
  assertEquals(cmd.window?.length, WINDOW_LENGTH);
  for (let slot = CENTER_SLOT + 1; slot < WINDOW_LENGTH; slot++) {
    assertEquals(cmd.window?.[slot] !== undefined, true);
  }
});

Deno.test("jump with forward ephemeral preview centers on canonical not preview seq", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.controller.enqueuePreview("c4");
  harness.fireScheduled();

  harness.published.length = 0;
  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  const center = cmd.window?.[CENTER_SLOT];

  assertEquals(cmd.type, "jump");
  assertEquals(center?.submissionId, "c4");
  assertEquals(center?.ephemeral, undefined);
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
  const { controller, published } = createTestController();
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

function seedTapeWithDestinations(
  harness: ReturnType<typeof createTestController>,
  len: number,
  labels: string[],
): TrainStep[] {
  const snap = harness.controller.exportSnapshot();
  snap.window.forEach((step, i) => {
    if (step.destination !== undefined) step.destination = labels[i] ?? `Station${i}`;
  });
  harness.controller.restoreFromSnapshot(snap, ids(len));
  return snap.window.map((step) => ({ ...step }));
}

function expectedDestinationForStep(
  step: TrainStep,
  preJump: TrainStep[],
): string | undefined {
  const bySeq = preJump.find((pre) => pre.seq === step.seq && pre.destination);
  if (bySeq?.destination) return bySeq.destination;
  if (step.kind !== "post" || !step.submissionId) {
    return preJump.find((pre) => pre.kind === "qr")?.destination;
  }
  const match = preJump.find(
    (pre) =>
      pre.kind === "post" &&
      pre.submissionId === step.submissionId &&
      !!pre.ephemeral === !!step.ephemeral &&
      pre.destination,
  );
  return match?.destination;
}

function assertPreJumpDestinationsPreserved(
  steps: TrainStep[],
  preJump: TrainStep[],
): void {
  for (const step of steps) {
    const expected = expectedDestinationForStep(step, preJump);
    if (expected !== undefined) {
      assertEquals(step.destination, expected);
    }
  }
}

Deno.test("ephemeral center does not advance currentCabin with in-chain and queued previews", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  assertEquals(harness.controller.getState().currentCabin, 1);

  harness.controller.enqueuePreview("c10");
  harness.fireScheduled();
  harness.controller.enqueuePreview("c8");
  harness.fireScheduled();

  let sawEphemeralCenter = false;
  for (let i = 0; i < 40; i++) {
    const win = harness.controller.getState().window;
    const center = win[CENTER_SLOT];
    if (center?.ephemeral && center.submissionId) {
      sawEphemeralCenter = true;
      const ephemeralCabin = Number.parseInt(center.submissionId.slice(1), 10);
      assertEquals(
        harness.controller.getState().currentCabin !== ephemeralCabin,
        true,
      );
    }
    if (center?.submissionId === "c2" && !center.ephemeral) break;
    harness.fireScheduled();
  }

  assertEquals(sawEphemeralCenter, true);
  assertEquals(harness.controller.getState().currentCabin, 2);
});

Deno.test("in-chain jump preserves pre-jump roof destinations in overlay and window", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  const preJump = seedTapeWithDestinations(
    harness,
    10,
    ["S1", "S2", "S3", "S4", "S5", "S6", "S7"],
  );
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 4 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertPreJumpDestinationsPreserved(cmd.window ?? [], preJump);
});

Deno.test("far jump with on-path ephemeral preserves pre-jump roof destinations", () => {
  const harness = createTestController();
  harness.controller.initialize(10, ids(10));
  harness.fireScheduled();
  harness.fireScheduled();
  harness.controller.enqueuePreview("c10");
  harness.fireScheduled();
  const preJump = seedTapeWithDestinations(
    harness,
    10,
    ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
  );
  harness.published.length = 0;

  harness.controller.handleUserCommand({ type: "jump", cabinNumber: 5 });
  const cmd = harness.published[0];
  assertEquals(cmd.type, "jump");
  assertPreJumpDestinationsPreserved(cmd.window ?? [], preJump);
});
