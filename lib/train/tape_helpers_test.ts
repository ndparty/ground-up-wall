import { assertEquals } from "@std/assert";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { CENTER_SLOT } from "./train_view_constants.ts";
import {
  findPostInTape,
  forwardSlotSteps,
  subsampleStepWindows,
} from "./tape_helpers.ts";

function post(id: string, seq: number): TrainStep {
  return { seq, kind: "post", submissionId: id };
}

Deno.test("findPostInTape locates submission in tape", () => {
  const tape = [post("a", 1), post("b", 2), post("c", 3)];
  assertEquals(findPostInTape(tape, "b"), 1);
  assertEquals(findPostInTape(tape, "z"), null);
});

Deno.test("forwardSlotSteps counts slots forward from center", () => {
  assertEquals(forwardSlotSteps([], CENTER_SLOT + 2), 2);
  assertEquals(forwardSlotSteps([], CENTER_SLOT), 0);
});

Deno.test("subsampleStepWindows picks evenly spaced windows", () => {
  const windows = Array.from({ length: 10 }, (_, i) => [post(`w${i}`, i)]);
  const sampled = subsampleStepWindows(windows, 3);
  assertEquals(sampled.length, 3);
  assertEquals(sampled[0], windows[2]);
  assertEquals(sampled[2], windows[9]);
});
