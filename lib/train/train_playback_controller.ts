import type { TrainCommand } from "../interfaces/realtime_service.ts";
import { clampDwellSeconds } from "./display_helpers.ts";

export interface TrainPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds: number;
  lastTransitionAt: number;
  cabinCount: number;
}

export interface TrainPlaybackControllerDeps {
  publish: (command: TrainCommand) => void;
  now?: () => number;
  schedule?: (fn: () => void, delayMs: number) => void;
  cancelSchedule?: () => void;
}

export class TrainPlaybackController {
  private readonly publish: (command: TrainCommand) => void;
  private readonly now: () => number;
  private readonly scheduleFn: (fn: () => void, delayMs: number) => void;
  private readonly cancelScheduleFn: () => void;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private pausedForOverride = false;

  private state: TrainPlaybackState = {
    isPlaying: true,
    currentCabin: 1,
    dwellSeconds: 15,
    lastTransitionAt: Date.now(),
    cabinCount: 0,
  };

  constructor(deps: TrainPlaybackControllerDeps) {
    this.publish = deps.publish;
    this.now = deps.now ?? (() => Date.now());
    this.scheduleFn = deps.schedule ?? ((fn, delayMs) => {
      this.timerId = setTimeout(fn, delayMs);
    });
    this.cancelScheduleFn = deps.cancelSchedule ?? (() => {
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    });
  }

  getState(): TrainPlaybackState {
    return { ...this.state };
  }

  initialize(dwellSeconds: number, cabinCount: number): void {
    this.state.dwellSeconds = clampDwellSeconds(dwellSeconds);
    this.state.cabinCount = Math.max(0, cabinCount);
    this.state.currentCabin = this.clampCabin(this.state.currentCabin);
    if (!this.initialized) {
      this.state.lastTransitionAt = this.now();
      this.initialized = true;
    }
    this.scheduleNextTick();
  }

  handleUserCommand(command: TrainCommand): void {
    if (command.type === "pause") {
      this.pause();
      return;
    }
    if (command.type === "play") {
      this.play();
      return;
    }
    if (command.type === "jump" && command.cabinNumber !== undefined) {
      this.jump(command.cabinNumber);
    }
  }

  setDwellSeconds(dwellSeconds: number): void {
    this.state.dwellSeconds = clampDwellSeconds(dwellSeconds);
    this.scheduleNextTick();
  }

  setCabinCount(cabinCount: number): void {
    this.state.cabinCount = Math.max(0, cabinCount);
    this.state.currentCabin = this.clampCabin(this.state.currentCabin);
    this.scheduleNextTick();
  }

  /** Stop dwell timer while blank/placeholder override is active (FR-24c). */
  pauseForOverride(): void {
    this.pausedForOverride = true;
    this.cancelScheduleFn();
  }

  /** Resume dwell scheduling after display override ends. */
  resumeFromOverride(): void {
    this.pausedForOverride = false;
    this.scheduleNextTick();
  }

  private clampCabin(cabin: number): number {
    if (this.state.cabinCount === 0) return 1;
    return Math.max(1, Math.min(cabin, this.state.cabinCount));
  }

  private pause(): void {
    this.state.isPlaying = false;
    this.cancelScheduleFn();
    this.publish({ type: "pause" });
  }

  private play(): void {
    this.state.isPlaying = true;
    this.state.lastTransitionAt = this.now();
    this.publish({ type: "play" });
    this.scheduleNextTick();
  }

  private jump(cabinNumber: number): void {
    this.state.currentCabin = this.clampCabin(cabinNumber);
    this.state.lastTransitionAt = this.now();
    this.publish({ type: "jump", cabinNumber: this.state.currentCabin });
    this.scheduleNextTick();
  }

  private advance(): void {
    if (this.state.cabinCount === 0) return;

    const nextCabin = this.state.currentCabin >= this.state.cabinCount
      ? 1
      : this.state.currentCabin + 1;
    this.state.currentCabin = nextCabin;
    this.state.lastTransitionAt = this.now();
    this.publish({ type: "advance", cabinNumber: nextCabin });
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    this.cancelScheduleFn();
    if (this.pausedForOverride || !this.state.isPlaying || this.state.cabinCount === 0) return;

    const elapsed = this.now() - this.state.lastTransitionAt;
    const remaining = Math.max(0, this.state.dwellSeconds * 1000 - elapsed);
    this.scheduleFn(() => this.advance(), remaining);
  }
}
