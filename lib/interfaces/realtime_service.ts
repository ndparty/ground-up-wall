import type { Submission, SystemConfig } from "../types.ts";

export type UnsubscribeFn = () => void;

/** One generated cabin slot on the display tape (FR-20a generator model). */
export interface TrainStep {
  /** Monotonic id, unique per emission — used as the render/DOM key. */
  seq: number;
  kind: "post" | "qr";
  /** Approved submission id for `post` steps (id-based; resolved client-side). */
  submissionId?: string;
  /** Destination-board label (random MRT/LRT station per emission). */
  destination?: string;
}

export interface TrainCommand {
  type: "pause" | "play" | "jump" | "advance";
  cabinNumber?: number;
  /** Server-authoritative window of generated cabins (advance + jump). */
  window?: TrainStep[];
  /** Position (1-based) of the centered post within the canonical list. */
  currentCabin?: number;
  /** Forward slide count for jump animation. */
  stepsToTarget?: number;
  /** @deprecated Client uses final `window` + `stepsToTarget` only; no multi-step playback. */
  stepWindows?: TrainStep[][];
}

export interface DisplayOverrideCommand {
  type: "blank" | "placeholder" | "resume";
  imageUrl?: string;
}

export interface RealtimeService {
  publish(channel: string, payload: unknown): Promise<void>;
  subscribe(channel: string, callback: (payload: unknown) => void): UnsubscribeFn;
  onSubmissionApproved(callback: (submission: Submission) => void): UnsubscribeFn;
  onSubmissionCreated(callback: (submission: Submission) => void): UnsubscribeFn;
  onSubmissionEdited(callback: (submission: Submission) => void): UnsubscribeFn;
  onSubmissionRejected(callback: (payload: { id: string }) => void): UnsubscribeFn;
  onTrainCommand(callback: (command: TrainCommand) => void): UnsubscribeFn;
  onSystemConfigChanged(callback: (config: SystemConfig) => void): UnsubscribeFn;
  onDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn;
}
