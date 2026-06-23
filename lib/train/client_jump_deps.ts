import { QR_CABIN_DESTINATION } from "../defaults/app_defaults.ts";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import { buildAppendOnlyJump, type AppendOnlyJumpDeps } from "./tape_helpers.ts";
import {
  getCurrentCabin,
  getRenderWindow,
  renderWindowToSteps,
  type TrainViewState,
} from "./train_view.ts";

function maxSeqInTape(tape: TrainStep[]): number {
  return tape.reduce((max, step) => Math.max(max, step.seq), 0);
}

function destinationForSubmission(tape: TrainStep[], submissionId: string): string | undefined {
  for (const step of tape) {
    if (step.kind === "post" && step.submissionId === submissionId && step.destination) {
      return step.destination;
    }
  }
  return undefined;
}

/** Build append-only jump deps from the client's current render tape. */
export function createClientJumpDeps(
  view: TrainViewState,
  startSeq: number,
): AppendOnlyJumpDeps & { nextSeq: () => number } {
  const tape = renderWindowToSteps(getRenderWindow(view));
  const canonical = view.canonical;
  let seq = startSeq;

  function nextSeq(): number {
    return seq++;
  }

  return {
    nextSeq,
    emitNextStep: () => ({
      seq: nextSeq(),
      kind: "qr",
      destination: QR_CABIN_DESTINATION,
      ephemeral: true,
    }),
    createCanonicalPost: (cabin: number) => {
      const submission = canonical[cabin - 1];
      if (!submission) {
        throw new Error(`No canonical submission for cabin ${cabin}`);
      }
      return {
        seq: nextSeq(),
        kind: "post",
        submissionId: submission.id,
        destination: destinationForSubmission(tape, submission.id),
      };
    },
  };
}

/** Recompute jump animation path from client view (server committed window unchanged). */
export function rebuildDeferredJumpAnimation(
  view: TrainViewState,
  targetCabin: number,
): { animationWindow: TrainStep[]; stepsToTarget: number } {
  const startTape = renderWindowToSteps(getRenderWindow(view));
  const fromCabin = getCurrentCabin(view);
  const cabinIds = view.canonical.map((s) => s.id);
  const deps = createClientJumpDeps(view, maxSeqInTape(startTape) + 1);
  const result = buildAppendOnlyJump(startTape, fromCabin, targetCabin, cabinIds, deps);
  return {
    animationWindow: result.animationWindow,
    stepsToTarget: result.stepsToTarget,
  };
}
