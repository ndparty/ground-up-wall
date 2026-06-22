import { assertEquals } from "@std/assert";
import type { Submission } from "../types.ts";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { rebuildDeferredJumpAnimation } from "./client_jump_deps.ts";
import { applyServerWindow, initTrainView } from "./train_view.ts";

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
