import type { TrainCommand, TrainStep } from "../interfaces/realtime_service.ts";
import { clampDwellSeconds } from "./display_helpers.ts";
import { QR_CABIN_DESTINATION } from "../defaults/app_defaults.ts";
import { pickRandomStation } from "../copy/mrt_stations.ts";
import {
  CENTER_SLOT,
  LEFT_RENDER,
  RIGHT_RENDER,
  WINDOW_LENGTH,
} from "./train_view_constants.ts";
import {
  buildAppendOnlyJump,
  preserveDestinationsFromPreJumpTape,
} from "./tape_helpers.ts";

export interface TrainPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds: number;
  lastTransitionAt: number;
  cabinCount: number;
  /** Server-authoritative window of generated cabins (FR-20a generator model). */
  window: TrainStep[];
}

export interface TrainPlaybackSnapshot {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds: number;
  lastTransitionAt: number;
  genIndex: number;
  cabinIds: string[];
  window: TrainStep[];
  seqCounter: number;
}

export interface TrainPlaybackControllerDeps {
  publish: (command: TrainCommand) => void;
  now?: () => number;
  schedule?: (fn: () => void, delayMs: number) => void;
  cancelSchedule?: () => void;
}

type QueuedEphemeral = { kind: "qr" } | { kind: "post"; submissionId: string };

/**
 * Server-authoritative train generator (FR-20a / FR-22).
 *
 * The canonical sequence is the ordered list of approved submission ids, walked
 * forward with wraparound. Each dwell tick emits ONE cabin at the right edge of a
 * fixed-length window (`WINDOW_LENGTH`): the front of the ephemeral FIFO queue if
 * present (approved previews + QR cabins), otherwise the next sequential post.
 * The full window is broadcast every tick so all displays stay in lockstep and
 * late-joiners/refreshes restore exactly (FR-24a / NFR-11). Ephemerals enter from
 * the right and fall off the left strictly outside the visible band.
 */
export class TrainPlaybackController {
  private readonly publish: (command: TrainCommand) => void;
  private readonly now: () => number;
  private readonly scheduleFn: (fn: () => void, delayMs: number) => void;
  private readonly cancelScheduleFn: () => void;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private pausedForOverride = false;

  private cabinIds: string[] = [];
  private genIndex = 0;
  private queue: QueuedEphemeral[] = [];
  private qrInterval = 0;
  private emitCount = 0;
  private seqCounter = 0;
  private tape: TrainStep[] = [];

  private state: Omit<TrainPlaybackState, "window"> = {
    isPlaying: true,
    currentCabin: 1,
    dwellSeconds: 10,
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
    return { ...this.state, window: [...this.tape] };
  }

  exportSnapshot(): TrainPlaybackSnapshot {
    return {
      isPlaying: this.state.isPlaying,
      currentCabin: this.state.currentCabin,
      dwellSeconds: this.state.dwellSeconds,
      lastTransitionAt: this.state.lastTransitionAt,
      genIndex: this.genIndex,
      cabinIds: [...this.cabinIds],
      window: this.tape.map((step) => ({ ...step })),
      seqCounter: this.seqCounter,
    };
  }

  /** Restore in-memory playback after server restart when cabin ids are still valid. */
  restoreFromSnapshot(snapshot: TrainPlaybackSnapshot, currentCabinIds: string[]): boolean {
    if (!snapshot.window?.length || currentCabinIds.length === 0) return false;

    for (const step of snapshot.window) {
      if (step.kind === "post" && step.submissionId) {
        if (!currentCabinIds.includes(step.submissionId)) return false;
      }
    }

    this.cabinIds = [...currentCabinIds];
    this.state = {
      isPlaying: snapshot.isPlaying,
      currentCabin: this.clampCabin(snapshot.currentCabin),
      dwellSeconds: clampDwellSeconds(snapshot.dwellSeconds),
      lastTransitionAt: snapshot.lastTransitionAt,
      cabinCount: this.cabinIds.length,
    };
    this.tape = snapshot.window.map((step) => ({ ...step }));
    this.genIndex = this.wrap(snapshot.genIndex);
    this.seqCounter = snapshot.seqCounter ||
      Math.max(0, ...snapshot.window.map((step) => step.seq));
    this.initialized = true;

    if (this.state.isPlaying && !this.pausedForOverride) {
      this.scheduleNextTick();
    }
    return true;
  }

  initialize(dwellSeconds: number, cabinIds: string[]): void {
    this.state.dwellSeconds = clampDwellSeconds(dwellSeconds);
    this.cabinIds = [...cabinIds];
    this.state.cabinCount = this.cabinIds.length;
    if (!this.initialized) {
      this.state.currentCabin = this.clampCabin(this.state.currentCabin);
      this.rebuildTape(this.state.currentCabin - 1);
      this.state.lastTransitionAt = this.now();
      this.initialized = true;
    } else {
      this.reconcileCabinIds();
    }
    this.scheduleNextTick();
  }

  setQrInterval(interval: number): void {
    this.qrInterval = Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 0;
  }

  /** Enqueue a preview of a just-approved submission (shown ahead of its turn). */
  enqueuePreview(submissionId: string): void {
    if (this.cabinIds.length <= 1) return;
    if (this.queue.some((q) => q.kind === "post" && q.submissionId === submissionId)) return;
    this.queue.push({ kind: "post", submissionId });
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

  setCabinIds(cabinIds: string[]): void {
    this.cabinIds = [...cabinIds];
    this.state.cabinCount = this.cabinIds.length;
    this.reconcileCabinIds();
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

  /** Rebuild tape from scratch (cleared queue, fresh seq ids) — used by reload/panic. */
  resetToFreshState(startCabin = 1): void {
    this.queue = [];
    this.emitCount = 0;
    this.seqCounter = 0;

    if (this.cabinIds.length === 0) {
      this.tape = [];
      this.genIndex = 0;
      this.state.currentCabin = 1;
      this.cancelScheduleFn();
      return;
    }

    this.state.currentCabin = this.clampCabin(startCabin);
    this.rebuildTape(this.state.currentCabin - 1);
    this.state.lastTransitionAt = this.now();
    this.scheduleNextTick();
  }

  private clampCabin(cabin: number): number {
    if (this.cabinIds.length === 0) return 1;
    return Math.max(1, Math.min(cabin, this.cabinIds.length));
  }

  private nextSeq(): number {
    this.seqCounter += 1;
    return this.seqCounter;
  }

  private wrap(idx: number): number {
    const len = this.cabinIds.length;
    if (len === 0) return 0;
    return ((idx % len) + len) % len;
  }

  private postStep(index: number): TrainStep {
    return {
      seq: this.nextSeq(),
      kind: "post",
      submissionId: this.cabinIds[this.wrap(index)],
      destination: pickRandomStation(),
    };
  }

  private qrStep(): TrainStep {
    return { seq: this.nextSeq(), kind: "qr", destination: QR_CABIN_DESTINATION, ephemeral: true };
  }

  private syncCurrentCabinFromCenter(): void {
    const center = this.tape[CENTER_SLOT];
    if (
      center?.kind === "post" &&
      center.submissionId &&
      !center.ephemeral
    ) {
      const pos = this.cabinIds.indexOf(center.submissionId);
      if (pos >= 0) this.state.currentCabin = pos + 1;
    }
  }

  /** Rebuild the window centered on a canonical index (init / reconcile). */
  private rebuildTape(centerIdx: number): void {
    if (this.cabinIds.length === 0) {
      this.tape = [];
      this.genIndex = 0;
      this.state.currentCabin = 1;
      return;
    }
    const tape: TrainStep[] = [];
    for (let off = -LEFT_RENDER; off <= RIGHT_RENDER; off++) {
      tape.push(this.postStep(centerIdx + off));
    }
    this.tape = tape;
    this.genIndex = this.wrap(centerIdx + RIGHT_RENDER);
    this.state.currentCabin = this.wrap(centerIdx) + 1;
  }

  /** Re-center the window when the canonical list changes (approve/delete). */
  private reconcileCabinIds(): void {
    if (this.cabinIds.length === 0) {
      this.tape = [];
      this.genIndex = 0;
      this.state.currentCabin = 1;
      return;
    }
    this.state.currentCabin = this.clampCabin(this.state.currentCabin);
    this.queue = this.queue.filter(
      (q) => q.kind !== "post" || this.cabinIds.includes(q.submissionId),
    );
    if (this.tape.length === 0) {
      this.rebuildTape(this.state.currentCabin - 1);
    } else {
      this.genIndex = this.wrap(this.genIndex);
    }
  }

  /** Emit the next right-edge step (queue, QR interval, or sequential). Does not mutate tape. */
  private emitNextStep(): TrainStep {
    if (this.cabinIds.length === 0) {
      throw new Error("emitNextStep called with no cabins");
    }

    this.emitCount += 1;
    if (
      this.qrInterval > 0 && this.emitCount % this.qrInterval === 0 &&
      !this.queue.some((q) => q.kind === "qr")
    ) {
      this.queue.push({ kind: "qr" });
    }

    const queued = this.queue.shift();
    if (queued) {
      return queued.kind === "qr" ? this.qrStep() : {
        seq: this.nextSeq(),
        kind: "post",
        submissionId: queued.submissionId,
        destination: pickRandomStation(),
        ephemeral: true,
      };
    }

    this.genIndex = this.wrap(this.genIndex + 1);
    return this.postStep(this.genIndex);
  }

  /** Shift the live tape forward one slot. */
  private shiftTapeOnce(): void {
    if (this.cabinIds.length === 0) return;

    const step = this.emitNextStep();
    this.tape.push(step);
    if (this.tape.length > WINDOW_LENGTH) this.tape.shift();
    this.syncCurrentCabinFromCenter();
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
    if (this.cabinIds.length === 0) return;

    const targetCabin = this.clampCabin(cabinNumber);
    const startTape = [...this.tape];
    const fromCabin = this.state.currentCabin;

    const { animationWindow, committedTape, stepsToTarget } = buildAppendOnlyJump(
      startTape,
      fromCabin,
      targetCabin,
      this.cabinIds,
      {
        emitNextStep: () => this.emitNextStep(),
        createCanonicalPost: (cabin) => this.postStep(cabin - 1),
      },
    );

    preserveDestinationsFromPreJumpTape(animationWindow, startTape);
    preserveDestinationsFromPreJumpTape(committedTape, startTape);

    this.tape = committedTape;
    this.state.currentCabin = targetCabin;
    this.genIndex = this.wrap(targetCabin - 1 + RIGHT_RENDER);
    this.state.lastTransitionAt = this.now();

    this.publish({
      type: "jump",
      cabinNumber: this.state.currentCabin,
      currentCabin: this.state.currentCabin,
      window: [...this.tape],
      animationWindow,
      stepsToTarget,
    });
    this.scheduleNextTick();
  }

  /** One dwell tick: emit the next right-edge cabin and shift the window forward. */
  private advance(): void {
    if (this.cabinIds.length === 0) return;

    this.shiftTapeOnce();
    this.state.lastTransitionAt = this.now();
    this.publish({
      type: "advance",
      cabinNumber: this.state.currentCabin,
      window: [...this.tape],
      currentCabin: this.state.currentCabin,
    });
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    this.cancelScheduleFn();
    if (this.pausedForOverride || !this.state.isPlaying || this.cabinIds.length === 0) return;

    const elapsed = this.now() - this.state.lastTransitionAt;
    const remaining = Math.max(0, this.state.dwellSeconds * 1000 - elapsed);
    this.scheduleFn(() => this.advance(), remaining);
  }
}
