import { assertEquals } from "@std/assert";
import type { Submission } from "../types.ts";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { rebuildDeferredJumpAnimation, createClientJumpDeps } from "./client_jump_deps.ts";
import { buildAppendOnlyJump } from "./tape_helpers.ts";
import { applyServerWindow, getRenderWindow, initTrainView, renderWindowToSteps } from "./train_view.ts";
import { applyCommitAdvance } from "./pending_advance.ts";

function makeSubmission(id: string, index: number): Submission {
  return {
    id,
    image_url: `/img/${id}.jpg`,
    message: `Message ${index}`,
    submitter_name: `User ${index}`,
    social_handle: `@user${index}`,
    status: "approved",
    source: "test",
    is_flagged: false,
    edit_count: 0,
    created_at: new Date().toISOString(),
  };
}

function postStep(id: string, seq: number): TrainStep {
  return { seq, kind: "post", submissionId: id };
}

Deno.test("rebuildDeferredJumpAnimation uses client fromCabin not server stale path", () => {
  const submissions = Array.from({ length: 10 }, (_, i) =>
    makeSubmission(`sub-${i + 1}`, i + 1)
  );
  let view = initTrainView(submissions);
  const startTape = [
    postStep("sub-1", 1), postStep("sub-2", 2), postStep("sub-3", 3),
    postStep("sub-4", 4), postStep("sub-5", 5), postStep("sub-6", 6), postStep("sub-7", 7),
  ];
  view = applyServerWindow(view, startTape, 3);

  const rebuilt = rebuildDeferredJumpAnimation(view, 7);
  assertEquals(rebuilt.stepsToTarget, 4);
  assertEquals(rebuilt.animationWindow.length >= 7, true);
});

Deno.test("rebuildDeferredJumpAnimation uses post-commit tape", () => {
  const submissions = Array.from({ length: 10 }, (_, i) =>
    makeSubmission(`sub-${i + 1}`, i + 1)
  );
  let view = initTrainView(submissions);
  const startTape = [
    postStep("sub-1", 1), postStep("sub-2", 2), postStep("sub-3", 3),
    postStep("sub-4", 4), postStep("sub-5", 5), postStep("sub-6", 6), postStep("sub-7", 7),
  ];
  view = applyServerWindow(view, startTape, 3);

  const preCommit = rebuildDeferredJumpAnimation(view, 7);
  assertEquals(preCommit.stepsToTarget, 4);

  const startSteps = renderWindowToSteps(getRenderWindow(view));
  const cabinIds = view.canonical.map((s) => s.id);
  const maxSeq = startSteps.reduce((max, step) => Math.max(max, step.seq), 0);
  const jumpTo5 = buildAppendOnlyJump(
    startSteps,
    3,
    5,
    cabinIds,
    createClientJumpDeps(view, maxSeq + 1),
  );
  view = applyCommitAdvance(view, {
    window: jumpTo5.committedTape,
    currentCabin: 5,
    kind: "jump",
    slideSteps: jumpTo5.stepsToTarget,
    animationWindow: jumpTo5.animationWindow,
  });

  const postCommit = rebuildDeferredJumpAnimation(view, 7);
  assertEquals(postCommit.stepsToTarget, 2);
  assertEquals(postCommit.stepsToTarget < preCommit.stepsToTarget, true);
});

Deno.test("applyCommitAdvance updates view current cabin from advance", () => {
  const submissions = Array.from({ length: 5 }, (_, i) =>
    makeSubmission(`sub-${i + 1}`, i + 1)
  );
  let view = initTrainView(submissions);
  const tape = [
    postStep("sub-1", 1), postStep("sub-2", 2), postStep("sub-3", 3),
    postStep("sub-4", 4), postStep("sub-5", 5),
  ];
  view = applyServerWindow(view, tape, 2);
  const updated = applyCommitAdvance(view, {
    window: tape,
    currentCabin: 4,
    kind: "advance",
  });
  assertEquals(updated.currentCabin, 4);
});
