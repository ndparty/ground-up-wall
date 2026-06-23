import { assertEquals } from "@std/assert";
import type { TrainCommand } from "../interfaces/realtime_service.ts";
import {
  deferJumpCommand,
  pendingWithoutJumps,
  shouldDeferJumpSse,
  takeDeferredJump,
} from "./jump_orchestrator_guard.ts";

function jumpCmd(cabin: number): TrainCommand {
  return {
    type: "jump",
    cabinNumber: cabin,
    window: [{ seq: 1, kind: "post", submissionId: "c1" }],
    stepsToTarget: 2,
  };
}

Deno.test("shouldDeferJumpSse true only while orchestrator busy", () => {
  assertEquals(shouldDeferJumpSse(false), false);
  assertEquals(shouldDeferJumpSse(true), true);
});

Deno.test("deferJumpCommand keeps latest jump", () => {
  const first = jumpCmd(3);
  const second = jumpCmd(7);
  assertEquals(deferJumpCommand(first, second), second);
  assertEquals(deferJumpCommand(null, second), second);
});

Deno.test("takeDeferredJump accepts jump with window only", () => {
  const jump = jumpCmd(5);
  assertEquals(takeDeferredJump(jump), jump);
  assertEquals(takeDeferredJump({ type: "pause" }), null);
  assertEquals(takeDeferredJump({ type: "jump", cabinNumber: 1 }), null);
  assertEquals(takeDeferredJump(null), null);
});

Deno.test("pendingWithoutJumps keeps advances and drops jumps", () => {
  const pending = [
    { kind: "advance" as const, id: 1 },
    { kind: "jump" as const, id: 2 },
    { kind: "advance" as const, id: 3 },
  ];
  assertEquals(pendingWithoutJumps(pending), [
    { kind: "advance", id: 1 },
    { kind: "advance", id: 3 },
  ]);
});
