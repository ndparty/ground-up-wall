import { assertEquals } from "@std/assert";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { CENTER_SLOT } from "./train_view_constants.ts";
import {
  findForwardCanonicalPostInTape,
  findForwardPostInTape,
  findPostInTape,
  forwardSlotSteps,
  hasEphemeralOnPathToSlot,
  hasForwardEphemeralPostInTape,
  linearizeShiftSequence,
  mergeRightBufferSteps,
  subsampleStepWindows,
} from "./tape_helpers.ts";

function post(id: string, seq: number, ephemeral?: boolean): TrainStep {
  return { seq, kind: "post", submissionId: id, ephemeral };
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
