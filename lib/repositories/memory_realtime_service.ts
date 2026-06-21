import type {
  DisplayOverrideCommand,
  RealtimeService,
  TrainCommand,
  UnsubscribeFn,
} from "../interfaces/realtime_service.ts";
import type { Submission, SystemConfig } from "../types.ts";

export class MemoryRealtimeService implements RealtimeService {
  private channels = new Map<string, Set<(payload: unknown) => void>>();

  async publish(channel: string, payload: unknown): Promise<void> {
    const subscribers = this.channels.get(channel);
    if (!subscribers) return;
    for (const callback of subscribers) {
      try {
        callback(payload);
      } catch {
        // Isolate failing subscribers so one bad client cannot block others.
      }
    }
  }

  subscribe(channel: string, callback: (payload: unknown) => void): UnsubscribeFn {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(callback);
    return () => {
      this.channels.get(channel)?.delete(callback);
    };
  }

  onSubmissionApproved(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.subscribe("submission:approved", (payload) => callback(payload as Submission));
  }

  onSubmissionCreated(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.subscribe("submission:created", (payload) => callback(payload as Submission));
  }

  onSubmissionEdited(callback: (submission: Submission) => void): UnsubscribeFn {
    return this.subscribe("submission:edited", (payload) => callback(payload as Submission));
  }

  onSubmissionRejected(callback: (payload: { id: string }) => void): UnsubscribeFn {
    return this.subscribe("submission:rejected", (payload) => callback(payload as { id: string }));
  }

  onTrainCommand(callback: (command: TrainCommand) => void): UnsubscribeFn {
    return this.subscribe("train:command", (payload) => callback(payload as TrainCommand));
  }

  onSystemConfigChanged(callback: (config: SystemConfig) => void): UnsubscribeFn {
    return this.subscribe("system_config:changed", (payload) => callback(payload as SystemConfig));
  }

  onDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn {
    return this.subscribe(
      "display_override:command",
      (payload) => callback(payload as DisplayOverrideCommand),
    );
  }
}
