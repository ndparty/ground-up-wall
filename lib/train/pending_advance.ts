import type { TrainStep } from "../interfaces/realtime_service.ts";
import { applyServerWindow, type TrainViewState } from "./train_view.ts";

export interface PendingAdvance {
  window: TrainStep[];
  currentCabin: number;
  kind: "advance" | "jump";
  slideSteps?: number;
  animationWindow?: TrainStep[];
  fromCabin?: number;
}

/** Apply the head pending advance to a view (sync; used by commitAdvance and tests). */
export function applyCommitAdvance(
  view: TrainViewState,
  advance: PendingAdvance,
): TrainViewState {
  return applyServerWindow(view, advance.window, advance.currentCabin);
}
