import type { Submission, SystemConfig } from "../types.ts";

export type UnsubscribeFn = () => void;

export interface TrainCommand {
  type: "pause" | "play" | "jump";
  cabinNumber?: number;
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
  onTrainCommand(callback: (command: TrainCommand) => void): UnsubscribeFn;
  onSystemConfigChanged(callback: (config: SystemConfig) => void): UnsubscribeFn;
  onDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn;
}
