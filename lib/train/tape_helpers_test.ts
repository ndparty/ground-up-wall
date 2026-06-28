import { assertEquals } from "@std/assert";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { computeJumpAnimationPath } from "./train_view.ts";
import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER } from "./train_view_constants.ts";
import {
  appendFullEndStateBlock,
  appendRightBufferFromSnapshot,
  appendRightBufferOnly,
  buildAppendOnlyJump,
  buildJumpAnimationWindow,
  buildReconcileBridge,
  cabinsAroundTargetWithBuffer,
  canonicalCabinNumbersOnTape,
  canonicalSuffixPrefixOverlap,
  collectDestinationsBySeq,
  findForwardCanonicalPostInTape,
  findForwardPostInTape,
  findPostInTape,
  forwardSlotSteps,
  hasCanonicalPostInLinear,
  hasEphemeralOnPathToSlot,
  hasForwardEphemeralPostInTape,
  identityKey,
  isCanonicalAtCenter,
  linearizeShiftSequence,
  longestIdentityOverlap,
  preserveDestinationsFromPreJumpTape,
  QR_IDENTITY,
  subsampleStepWindows,
  windowsIdentityEqual,
} from "./tape_helpers.ts";
import { computeJumpStepCount } from "./train_view.ts";

function post(id: string, seq: number, ephemeral?: boolean): TrainStep {
  return { seq, kind: "post", submissionId: id, ephemeral };
}

function postWithDest(
  id: string,
  seq: number,
  destination: string,
  ephemeral?: boolean,
): TrainStep {
  return { seq, kind: "post", submissionId: id, destination, ephemeral };
}

function cabinId(n: number): string {
  return `c${n}`;
}

function postCabin(cabin: number, seq: number): TrainStep {
  return post(cabinId(cabin), seq);
}

function appendedTailCabins(
  prefixLen: number,
  window: TrainStep[],
  cabinIds: string[],
): number[] {
  return canonicalCabinNumbersOnTape(window.slice(prefixLen), cabinIds);
}

function buildCenterShiftSnapshots(
  fromCenterCabin: number,
  shiftCount: number,
  len: number,
  startSeq: number,
): TrainStep[][] {
  const snapshots: TrainStep[][] = [];
  let seq = startSeq;
  for (let shift = 1; shift <= shiftCount; shift++) {
    const centerCabin = ((fromCenterCabin - 1 + shift) % len) + 1;
    const window: TrainStep[] = [];
    for (let off = -LEFT_RENDER; off <= RIGHT_RENDER; off++) {
      const cabin = ((centerCabin - 1 + off + len) % len) + 1;
      window.push(postCabin(cabin, seq++));
    }
    snapshots.push(window);
  }
  return snapshots;
}

Deno.test("findPostInTape locates submission in tape", () => {
  const tape = [post("a", 1), post("b", 2), post("c", 3)];
  assertEquals(findPostInTape(tape, "b"), 1);
  assertEquals(findPostInTape(tape, "z"), null);
});

Deno.test("findForwardPostInTape skips preview at center and picks rightmost forward slot", () => {
  const tape = [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("d", 4),
    post("d", 5),
    post("e", 6),
    post("f", 7),
  ];
  assertEquals(findForwardPostInTape(tape, "d"), 4);
  assertEquals(findForwardPostInTape(tape, "b"), null);
  assertEquals(findForwardPostInTape(tape, "z"), null);
});

Deno.test("findForwardCanonicalPostInTape ignores ephemeral preview-only forward match", () => {
  const tape = [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("d", 4, true),
    post("e", 5),
    post("f", 6),
    post("g", 7),
  ];
  assertEquals(findForwardCanonicalPostInTape(tape, "d"), null);
  assertEquals(hasForwardEphemeralPostInTape(tape, "d"), true);
});

Deno.test("findForwardCanonicalPostInTape picks rightmost non-ephemeral when both exist", () => {
  const tape = [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("d", 4, true),
    post("e", 5),
    post("d", 6),
    post("f", 7),
  ];
  assertEquals(findForwardCanonicalPostInTape(tape, "d"), 5);
});

Deno.test("hasEphemeralOnPathToSlot detects ephemerals between center and target", () => {
  const tape = [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("x", 4, true),
    post("d", 5),
    post("e", 6),
    post("f", 7),
  ];
  assertEquals(hasEphemeralOnPathToSlot(tape, 4), true);
  assertEquals(hasEphemeralOnPathToSlot(tape, 3), true);
  assertEquals(hasEphemeralOnPathToSlot(tape, 2), false);
});

Deno.test("hasEphemeralOnPathToSlot false when path is all canonical", () => {
  const tape = [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("d", 4),
    post("e", 5),
    post("f", 6),
    post("g", 7),
  ];
  assertEquals(hasEphemeralOnPathToSlot(tape, 5), false);
});

Deno.test("forwardSlotSteps counts slots forward from center", () => {
  assertEquals(forwardSlotSteps([], CENTER_SLOT + 2), 2);
  assertEquals(forwardSlotSteps([], CENTER_SLOT), 0);
});

Deno.test("linearizeShiftSequence appends new right-edge steps from snapshots", () => {
  const start = [post("a", 1), post("b", 2), post("c", 3)];
  const snapshots = [
    [post("b", 2), post("c", 3), post("d", 4)],
    [post("c", 3), post("d", 4), post("e", 5)],
  ];
  assertEquals(linearizeShiftSequence(start, snapshots), [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("d", 4),
    post("e", 5),
  ]);
});

Deno.test("subsampleStepWindows picks evenly spaced windows", () => {
  const windows = Array.from({ length: 10 }, (_, i) => [post(`w${i}`, i)]);
  const sampled = subsampleStepWindows(windows, 3);
  assertEquals(sampled.length, 3);
  assertEquals(sampled[0], windows[2]);
  assertEquals(sampled[2], windows[9]);
});

Deno.test("buildJumpAnimationWindow 9 to 14 appends forward cabins without duplicate ids", () => {
  const len = 15;
  const cabinIds = Array.from({ length: len }, (_, i) => cabinId(i + 1));
  const startTape = [
    postCabin(7, 1),
    postCabin(8, 2),
    postCabin(9, 3),
    postCabin(10, 4),
    postCabin(11, 5),
    postCabin(12, 6),
    postCabin(13, 7),
  ];
  const snapshots: TrainStep[][] = [];
  let seq = 8;
  for (let i = 10; i <= 14; i++) {
    snapshots.push([
      postCabin(i - 2, seq++),
      postCabin(i - 1, seq++),
      postCabin(i, seq++),
      postCabin(i + 1 > len ? 1 : i + 1, seq++),
      postCabin(i + 2 > len ? i + 2 - len : i + 2, seq++),
      postCabin(i + 3 > len ? i + 3 - len : i + 3, seq++),
      postCabin(i + 4 > len ? i + 4 - len : i + 4, seq++),
    ]);
  }
  const overlay = buildJumpAnimationWindow(startTape, 9, 14, len, snapshots, cabinIds);
  assertEquals(overlay.some((s) => s.submissionId === "c14"), true);
});

Deno.test("appendRightBufferFromSnapshot appends forward slots after center", () => {
  const start = [post("a", 1), post("b", 2), post("c", 3)];
  const snapshot = [
    post("a", 1),
    post("b", 2),
    post("c", 3),
    post("d", 4),
    post("e", 5),
    post("f", 6),
    post("g", 7),
  ];
  assertEquals(appendRightBufferFromSnapshot(start, snapshot).length, 7);
});

Deno.test("buildJumpAnimationWindow 9 to 16 collapsed path includes buffer tail on len 20", () => {
  const len = 20;
  const cabinIds = Array.from({ length: len }, (_, i) => cabinId(i + 1));
  const startTape = [
    postCabin(7, 1),
    postCabin(8, 2),
    postCabin(9, 3),
    postCabin(10, 4),
    postCabin(11, 5),
    postCabin(12, 6),
    postCabin(13, 7),
  ];
  const snapshots = buildCenterShiftSnapshots(9, 7, len, 8);
  const overlay = buildJumpAnimationWindow(startTape, 9, 16, len, snapshots, cabinIds);
  for (const cabin of computeJumpAnimationPath(9, 16, len)) {
    assertEquals(overlay.some((s) => s.submissionId === cabinId(cabin)), true);
  }
  for (const cabin of [17, 18, 19, 20]) {
    assertEquals(overlay.some((s) => s.submissionId === cabinId(cabin)), true);
  }
});

Deno.test("preserveDestinationsFromPreJumpTape keeps labels by seq and post identity", () => {
  const preJump = [
    postWithDest("c4", 1, "Preview", true),
    postWithDest("c4", 2, "Canonical", false),
    postWithDest("c5", 3, "HoldFive", false),
  ];
  const rebuilt = [
    postWithDest("c4", 99, "Simulation", false),
    postWithDest("c5", 100, "NewFive", false),
    postWithDest("c4", 1, "Preview", true),
  ];
  preserveDestinationsFromPreJumpTape(rebuilt, preJump);
  assertEquals(rebuilt[0]?.destination, "Canonical");
  assertEquals(rebuilt[1]?.destination, "HoldFive");
  assertEquals(rebuilt[2]?.destination, "Preview");
});

Deno.test("collectDestinationsBySeq maps every labeled step", () => {
  const map = collectDestinationsBySeq([
    postWithDest("c1", 1, "A"),
    postWithDest("c2", 2, "B"),
  ]);
  assertEquals(map.get(1), "A");
  assertEquals(map.get(2), "B");
});

Deno.test("canonicalSuffixPrefixOverlap finds longest matching suffix", () => {
  const cabinIds = ids(10);
  const tape = [
    post("c1", 1),
    post("c2", 2),
    post("c3", 3),
    post("c4", 4),
    post("c5", 5),
    post("c6", 6),
    post("c7", 7),
  ];
  const endState = cabinsAroundTargetWithBuffer(9, 10);
  assertEquals(endState, [7, 8, 9, 10, 1, 2, 3]);
  assertEquals(canonicalSuffixPrefixOverlap(tape, endState, cabinIds), 1);
});

Deno.test("canonicalSuffixPrefixOverlap ignores ephemeral on tape", () => {
  const cabinIds = ids(10);
  const tape = [
    post("c1", 1),
    post("c2", 2),
    post("c3", 3),
    post("c4", 4),
    post("c5", 5),
    post("c6", 6),
    post("c8", 7, true),
  ];
  const endState = cabinsAroundTargetWithBuffer(9, 10);
  assertEquals(canonicalSuffixPrefixOverlap(tape, endState, cabinIds), 0);
});

Deno.test("appendRightBufferOnly fills only right-of-target preload", () => {
  const start = [
    post("c3", 1),
    post("c4", 2),
    post("c5", 3),
    post("c6", 4),
    post("c7", 5),
    post("c8", 6),
    post("c9", 7),
  ];
  let emitted = 0;
  const result = appendRightBufferOnly(start, CENTER_SLOT, () => {
    emitted++;
    return post("c10", 100 + emitted);
  });
  assertEquals(emitted, 0);
  assertEquals(result.length, 7);
});

Deno.test("buildAppendOnlyJump long jump c3 to c9 appends minimal tail", () => {
  const startTape = [
    postCabin(1, 1),
    postCabin(2, 2),
    postCabin(3, 3),
    postCabin(4, 4),
    postCabin(5, 5),
    postCabin(6, 6),
    postCabin(7, 7),
  ];
  const cabinIds = ids(10);
  let nextSeq = 8;
  const result = buildAppendOnlyJump(startTape, 3, 9, cabinIds, {
    emitNextStep: () => postCabin(99, nextSeq++),
    createCanonicalPost: (cabin) => postCabin(cabin, nextSeq++),
  });

  assertEquals(result.stepsToTarget, computeJumpStepCount(3, 9, 10));
  assertEquals(result.animationWindow.length, 10);
  assertEquals(result.committedTape[CENTER_SLOT]?.submissionId, "c9");
  for (const cabin of [8, 9, 10]) {
    assertEquals(
      hasCanonicalPostInLinear(result.animationWindow, `c${cabin}`),
      true,
    );
  }
});

Deno.test("buildAppendOnlyJump appends steps without removing live prefix", () => {
  const startTape = [
    postWithDest("c1", 1, "One"),
    postWithDest("c2", 2, "Two"),
    postWithDest("c10", 3, "Preview", true),
    postWithDest("c3", 4, "Three"),
    postWithDest("c4", 5, "Four"),
    postWithDest("c5", 6, "Five"),
    postWithDest("c6", 7, "Six"),
  ];
  const cabinIds = Array.from({ length: 10 }, (_, i) => `c${i + 1}`);
  let nextSeq = 8;
  const result = buildAppendOnlyJump(startTape, 3, 5, cabinIds, {
    emitNextStep: () => postWithDest("c7", nextSeq++, "Seven"),
    createCanonicalPost: (cabin) => postWithDest(`c${cabin}`, nextSeq++, `Canon${cabin}`),
  });

  assertEquals(result.committedTape.length, 7);
  assertEquals(result.committedTape[CENTER_SLOT]?.submissionId, "c5");
  assertEquals(result.committedTape[CENTER_SLOT]?.ephemeral, undefined);
  assertEquals(result.animationWindow[2]?.seq, 3);
  assertEquals(result.animationWindow[2]?.destination, "Preview");
  assertEquals(result.stepsToTarget, 3);
});

Deno.test("buildAppendOnlyJump returns early when target already buffered", () => {
  const startTape = [
    post("c3", 1),
    post("c4", 2),
    post("c5", 3),
    post("c6", 4),
    post("c7", 5),
    post("c8", 6),
    post("c9", 7),
  ];
  const cabinIds = ids(10);
  let emitted = 0;
  const result = buildAppendOnlyJump(startTape, 5, 5, cabinIds, {
    emitNextStep: () => {
      emitted++;
      return post("c1", 100 + emitted);
    },
    createCanonicalPost: (cabin) => post(`c${cabin}`, 200 + cabin),
  });

  assertEquals(emitted, 0);
  assertEquals(result.animationWindow.length, 7);
  assertEquals(result.committedTape[CENTER_SLOT]?.submissionId, "c5");
  assertEquals(result.stepsToTarget, 0);
});

Deno.test("buildAppendOnlyJump long jump does not call emitNextStep", () => {
  const startTape = [
    postCabin(1, 1),
    postCabin(2, 2),
    postCabin(3, 3),
    postCabin(4, 4),
    postCabin(5, 5),
    postCabin(6, 6),
    postCabin(7, 7),
  ];
  const cabinIds = ids(10);
  let emitted = 0;
  let nextSeq = 8;
  buildAppendOnlyJump(startTape, 3, 9, cabinIds, {
    emitNextStep: () => {
      emitted++;
      return postCabin(99, nextSeq++);
    },
    createCanonicalPost: (cabin) => postCabin(cabin, nextSeq++),
  });
  assertEquals(emitted, 0);
});

Deno.test("buildAppendOnlyJump on-tape left of center uses long forward path J-N5", () => {
  const startTape = [
    postCabin(3, 1),
    postCabin(4, 2),
    postCabin(5, 3),
    postCabin(6, 4),
    postCabin(7, 5),
    postCabin(8, 6),
    postCabin(9, 7),
  ];
  const cabinIds = ids(10);
  let emitted = 0;
  let nextSeq = 8;
  const result = buildAppendOnlyJump(startTape, 5, 4, cabinIds, {
    emitNextStep: () => {
      emitted++;
      return postCabin(99, nextSeq++);
    },
    createCanonicalPost: (cabin) => postCabin(cabin, nextSeq++),
  });

  assertEquals(emitted, 0);
  assertEquals(result.stepsToTarget, computeJumpStepCount(5, 4, 10));
  assertEquals(result.committedTape[CENTER_SLOT]?.submissionId, "c4");
  assertEquals(findForwardCanonicalPostInTape(startTape, "c4"), null);
  assertEquals(result.animationWindow.length, 14);
  assertEquals(
    appendedTailCabins(startTape.length, result.animationWindow, cabinIds),
    [2, 3, 4, 5, 6, 7, 8],
  );
});

Deno.test("buildAppendOnlyJump on-tape left appends full end-state block c15 to c13", () => {
  const startTape = [
    postCabin(13, 1),
    postCabin(14, 2),
    postCabin(15, 3),
    postCabin(16, 4),
    postCabin(17, 5),
    postCabin(18, 6),
    postCabin(19, 7),
  ];
  const cabinIds = ids(20);
  let nextSeq = 8;
  const result = buildAppendOnlyJump(startTape, 15, 13, cabinIds, {
    emitNextStep: () => postCabin(99, nextSeq++),
    createCanonicalPost: (cabin) => postCabin(cabin, nextSeq++),
  });

  assertEquals(result.stepsToTarget, computeJumpStepCount(15, 13, 20));
  assertEquals(result.committedTape[CENTER_SLOT]?.submissionId, "c13");
  assertEquals(result.animationWindow.length, 14);
  assertEquals(
    appendedTailCabins(startTape.length, result.animationWindow, cabinIds),
    [11, 12, 13, 14, 15, 16, 17],
  );
});

Deno.test("appendFullEndStateBlock always appends seven cabins", () => {
  const startTape = [postCabin(13, 1), postCabin(14, 2), postCabin(15, 3)];
  let nextSeq = 4;
  const out = appendFullEndStateBlock(startTape, 13, 20, (cabin) => postCabin(cabin, nextSeq++));
  assertEquals(out.length, 10);
  assertEquals(
    appendedTailCabins(startTape.length, out, ids(20)),
    [11, 12, 13, 14, 15, 16, 17],
  );
});

Deno.test("buildAppendOnlyJump at-center canonical is no-op short", () => {
  const startTape = [
    postCabin(3, 1),
    postCabin(4, 2),
    postCabin(5, 3),
    postCabin(6, 4),
    postCabin(7, 5),
    postCabin(8, 6),
    postCabin(9, 7),
  ];
  const cabinIds = ids(10);
  assertEquals(isCanonicalAtCenter(startTape, "c5"), true);
  const result = buildAppendOnlyJump(startTape, 5, 5, cabinIds, {
    emitNextStep: () => postCabin(99, 100),
    createCanonicalPost: (cabin) => postCabin(cabin, 200 + cabin),
  });
  assertEquals(result.stepsToTarget, 0);
  assertEquals(result.animationWindow.length, 7);
});

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `c${i + 1}`);
}

function qr(seq: number): TrainStep {
  return { seq, kind: "qr", ephemeral: true };
}

function makeSeqCounter(start: number): () => number {
  let n = start;
  return () => ++n;
}

function identityKeys(steps: TrainStep[]): (string | null)[] {
  return steps.map(identityKey);
}

Deno.test("identityKey maps posts and QR", () => {
  assertEquals(identityKey(post("c1", 1)), "c1");
  assertEquals(identityKey(qr(2)), QR_IDENTITY);
});

Deno.test("buildReconcileBridge advance overlap=6 slides one slot", () => {
  const current = [
    postCabin(1, 1),
    postCabin(2, 2),
    postCabin(3, 3),
    postCabin(4, 4),
    postCabin(5, 5),
    postCabin(6, 6),
    postCabin(7, 7),
  ];
  const server = [
    postCabin(2, 8),
    postCabin(3, 9),
    postCabin(4, 10),
    postCabin(5, 11),
    postCabin(6, 12),
    postCabin(7, 13),
    postCabin(8, 14),
  ];
  assertEquals(longestIdentityOverlap(current, server), 6);
  const { slotDelta, committedSlice } = buildReconcileBridge(
    current,
    server,
    makeSeqCounter(100),
  );
  assertEquals(slotDelta, 1);
  assertEquals(windowsIdentityEqual(committedSlice, server), true);
});

Deno.test("buildReconcileBridge deep suspend overlap=0", () => {
  const current = [
    postCabin(1, 1),
    postCabin(2, 2),
    postCabin(3, 3),
    postCabin(4, 4),
    postCabin(5, 5),
    postCabin(6, 6),
    postCabin(7, 7),
  ];
  const server = [
    postCabin(8, 50),
    postCabin(9, 51),
    postCabin(10, 52),
    postCabin(11, 53),
    postCabin(12, 54),
    postCabin(13, 55),
    postCabin(14, 56),
  ];
  assertEquals(longestIdentityOverlap(current, server), 0);
  const { slotDelta, bridge, committedSlice } = buildReconcileBridge(
    current,
    server,
    makeSeqCounter(200),
  );
  assertEquals(slotDelta, 7);
  assertEquals(bridge.length, 14);
  assertEquals(windowsIdentityEqual(committedSlice, server), true);
  const bridgeSeqs = bridge.map((s) => s.seq);
  assertEquals(new Set(bridgeSeqs).size, bridgeSeqs.length);
});

Deno.test("buildReconcileBridge identity-equal windows is no-op slide", () => {
  const current = [
    postCabin(1, 1),
    postCabin(2, 2),
    postCabin(1, 3),
    postCabin(2, 4),
    postCabin(1, 5),
    postCabin(2, 6),
    postCabin(1, 7),
  ];
  const server = [
    postCabin(1, 8),
    postCabin(2, 9),
    postCabin(1, 10),
    postCabin(2, 11),
    postCabin(1, 12),
    postCabin(2, 13),
    postCabin(1, 14),
  ];
  const { slotDelta } = buildReconcileBridge(current, server, makeSeqCounter(50));
  assertEquals(slotDelta, 0);
});

Deno.test("buildReconcileBridge renumbers appended seqs after restart collision", () => {
  const current = [
    postCabin(1, 100),
    postCabin(2, 101),
    postCabin(3, 102),
    postCabin(4, 103),
    postCabin(5, 104),
    postCabin(6, 105),
    postCabin(7, 106),
  ];
  const server = [
    postCabin(5, 1),
    postCabin(6, 2),
    postCabin(7, 3),
    postCabin(8, 4),
    postCabin(9, 5),
    postCabin(10, 6),
    postCabin(11, 7),
  ];
  const nextSeq = makeSeqCounter(106);
  const { bridge, committedSlice } = buildReconcileBridge(current, server, nextSeq);
  const appended = bridge.slice(7);
  for (const step of appended) {
    assertEquals(step.seq > 106, true);
  }
  assertEquals(windowsIdentityEqual(committedSlice, server), true);
  const allSeqs = bridge.map((s) => s.seq);
  assertEquals(new Set(allSeqs).size, allSeqs.length);
});

Deno.test("buildReconcileBridge preserves QR ephemeral in server window", () => {
  const current = [
    postCabin(1, 1),
    postCabin(2, 2),
    postCabin(3, 3),
    postCabin(4, 4),
    postCabin(5, 5),
    postCabin(6, 6),
    postCabin(7, 7),
  ];
  const server = [
    postCabin(3, 10),
    postCabin(4, 11),
    qr(12),
    postCabin(5, 13),
    postCabin(6, 14),
    postCabin(7, 15),
    postCabin(8, 16),
  ];
  const { committedSlice } = buildReconcileBridge(current, server, makeSeqCounter(100));
  assertEquals(identityKeys(committedSlice), identityKeys(server));
});
