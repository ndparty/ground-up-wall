import { addSubmission, type TrainChain } from "./chain.ts";
import type { Submission } from "../types.ts";
import type { User } from "../types.ts";

export function shouldShowTrainControls(role: User["role"] | null | undefined): boolean {
  return role === "moderator" || role === "admin";
}

export function shouldScheduleTransition(isPlaying: boolean, hasCabins: boolean): boolean {
  return isPlaying && hasCabins;
}

export function applyApprovedWhilePaused(
  chain: TrainChain,
  submission: Submission,
  isPlaying: boolean,
): void {
  const currentId = chain.current?.submission.id ?? null;
  addSubmission(chain, submission);
  if (!isPlaying) {
    if (currentId) {
      chain.current = chain.nodes.find((n) => n.submission.id === currentId) ?? chain.current;
    } else {
      chain.current = null;
    }
  }
}

export function resumeFromPause(chain: TrainChain): void {
  if (!chain.current && chain.head) {
    chain.current = chain.head;
  }
}
