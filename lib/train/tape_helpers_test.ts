import { assertEquals } from "@std/assert";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { computeJumpAnimationPath } from "./train_view.ts";
import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER } from "./train_view_constants.ts";
import {
  appendRightBufferFromSnapshot,
  buildJumpAnimationWindow,
  collectDestinationsForJump,
  findForwardCanonicalPostInTape,
  findForwardPostInTape,
  findPostInTape,
  forwardSlotSteps,
  hasEphemeralOnPathToSlot,
  hasForwardEphemeralPostInTape,
  linearizeCenterShiftSequence,
  linearizeShiftSequence,
  mergeRightBufferSteps,
  subsampleStepWindows,
} from "./tape_helpers.ts";

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

Deno.test("mergeRightBufferSteps appends new steps without reordering current tape", () => {
  const current = [post("a", 1), post("b", 2), post("c", 3)];
  const animation = [post("b", 2), post("c", 3), post("d", 4), post("e", 5)];
  assertEquals(mergeRightBufferSteps(current, animation), [
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
    postCabin(7, 1), postCabin(8, 2), postCabin(9, 3), postCabin(10, 4),
    postCabin(11, 5), postCabin(12, 6), postCabin(13, 7),
  ];
  const snapshots: TrainStep[][] = [];
  let seq = 8;
  for (let i = 10; i <= 14; i++) {
    snapshots.push([
      postCabin(i - 2, seq++), postCabin(i - 1, seq++), postCabin(i, seq++),
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
    post("a", 1), post("b", 2), post("c", 3), post("d", 4),
    post("e", 5), post("f", 6), post("g", 7),
  ];
  assertEquals(appendRightBufferFromSnapshot(start, snapshot).length, 7);
});

Deno.test("buildJumpAnimationWindow 9 to 16 collapsed path includes buffer tail on len 20", () => {
  const len = 20;
  const cabinIds = Array.from({ length: len }, (_, i) => cabinId(i + 1));
  const startTape = [
    postCabin(7, 1), postCabin(8, 2), postCabin(9, 3), postCabin(10, 4),
    postCabin(11, 5), postCabin(12, 6), postCabin(13, 7),
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

Deno.test("collectDestinationsForJump prefers canonical over ephemeral", () => {
  const map = collectDestinationsForJump(
    [postWithDest("c4", 1, "Preview", true), postWithDest("c4", 2, "Seed", false)],
    [postWithDest("c4", 3, "Simulation", false)],
  );
  assertEquals(map.get("c4"), "Simulation");
});
