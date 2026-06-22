import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { fetchWithRetry } from "../client/fetch_with_retry.ts";
import { useReconnectingEventSource } from "../client/use_reconnecting_event_source.ts";
import type { ConnectionStatus } from "../client/use_reconnecting_event_source.ts";
import type {
  DisplayOverrideCommand,
  TrainCommand,
  TrainStep,
} from "../interfaces/realtime_service.ts";
import type { Submission, User } from "../types.ts";
import { mapCommandToOverrideState, type OverrideState } from "./display_override.ts";
import { rebuildDeferredJumpAnimation } from "./client_jump_deps.ts";
import { shouldApplyPlaybackStateWindow } from "./playback_state_sync.ts";
import {
  deferJumpCommand,
  pendingWithoutJumps,
  shouldDeferJumpSse,
  takeDeferredJump,
} from "./jump_orchestrator_guard.ts";
import {
  addApproved,
  applyServerWindow,
  getCanonicalCount,
  getCurrentCabin,
  initTrainView,
  removeSubmissionFromView,
  type TrainViewState,
  updateSubmissionInView,
} from "./train_view.ts";
import { CENTER_SLOT } from "./train_view_constants.ts";

interface ServerPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds?: number;
  lastTransitionAt?: number;
  window?: TrainStep[];
}

interface PendingAdvance {
  window: TrainStep[];
  currentCabin: number;
  kind: "advance" | "jump";
  slideSteps?: number;
  animationWindow?: TrainStep[];
  fromCabin?: number;
}

export type { PendingAdvance };

function parseSseData<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data as string) as T;
  } catch {
    return null;
  }
}

function centerKeyFromWindow(window: TrainStep[]): string | null {
  const center = window[CENTER_SLOT];
  return center ? `s${center.seq}` : null;
}

export interface UseTrainPlaybackResult {
  trainView: TrainViewState;
  isPlaying: boolean;
  userRole: User["role"] | null;
  currentCabin: number;
  trainLength: number;
  pendingAdvances: number;
  commitAdvance: () => string | null;
  peekPendingAdvance: () => PendingAdvance | null;
  hasJumpPending: () => boolean;
  pauseTrain: () => Promise<boolean>;
  resumeTrain: () => Promise<boolean>;
  jumpTrain: (cabinNumber: number) => Promise<boolean>;
  syncPlaybackFromServer: () => Promise<void>;
  bootstrapComplete: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => void;
  connectionStatus: ConnectionStatus;
  overrideState: OverrideState;
  reloadGeneration: number;
  setOrchestratorBusy: (busy: boolean) => void;
  flushDeferredJump: () => boolean;
  clearOrchestratorState: () => void;
}

async function publishTrainCommand(command: TrainCommand): Promise<boolean> {
  const res = await fetch("/api/display/train-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  return res.ok;
}

export function useTrainPlayback(): UseTrainPlaybackResult {
  const [trainView, setTrainViewState] = useState<TrainViewState>(() => initTrainView([]));
  const [isPlaying, setIsPlaying] = useState(true);
  const [userRole, setUserRole] = useState<User["role"] | null>(null);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [pendingAdvances, setPendingAdvances] = useState(0);
  const [overrideState, setOverrideState] = useState<OverrideState>({ type: "normal" });
  const [reloadGeneration, setReloadGeneration] = useState(0);

  const isPlayingRef = useRef(isPlaying);
  const pendingRef = useRef<PendingAdvance[]>([]);
  const trainViewRef = useRef(trainView);
  const orchestratorBusyRef = useRef(false);
  const deferredJumpRef = useRef<TrainCommand | null>(null);
  isPlayingRef.current = isPlaying;
  trainViewRef.current = trainView;

  function clearPending(): void {
    pendingRef.current = [];
    setPendingAdvances(0);
  }

  function enqueueAdvance(advance: PendingAdvance): void {
    pendingRef.current = [...pendingRef.current, advance];
    setPendingAdvances(pendingRef.current.length);
  }

  function enqueueJumpSteps(command: TrainCommand): void {
    if (!command.window) return;
    enqueueAdvance({
      window: command.window,
      currentCabin: command.currentCabin ?? 0,
      kind: "jump",
      slideSteps: command.stepsToTarget,
      animationWindow: command.animationWindow,
      fromCabin: getCurrentCabin(trainViewRef.current),
    });
  }

  const commitAdvance = useCallback((): string | null => {
    const next = pendingRef.current[0];
    pendingRef.current = pendingRef.current.slice(1);
    setPendingAdvances(pendingRef.current.length);
    if (!next) return null;
    setTrainViewState((prev) => applyServerWindow(prev, next.window, next.currentCabin));
    return centerKeyFromWindow(next.window);
  }, []);

  const peekPendingAdvance = useCallback((): PendingAdvance | null => {
    return pendingRef.current[0] ?? null;
  }, []);

  const hasJumpPending = useCallback((): boolean => {
    return pendingRef.current.some((p) => p.kind === "jump");
  }, []);

  const setOrchestratorBusy = useCallback((busy: boolean): void => {
    orchestratorBusyRef.current = busy;
  }, []);

  const clearOrchestratorState = useCallback((): void => {
    orchestratorBusyRef.current = false;
    deferredJumpRef.current = null;
  }, []);

  const flushDeferredJump = useCallback((): boolean => {
    const command = takeDeferredJump(deferredJumpRef.current);
    if (!command) return false;
    deferredJumpRef.current = null;
    pendingRef.current = pendingWithoutJumps(pendingRef.current);
    setPendingAdvances(pendingRef.current.length);
    if (!command.window || command.cabinNumber === undefined) return false;
    const { animationWindow, stepsToTarget } = rebuildDeferredJumpAnimation(
      trainViewRef.current,
      command.cabinNumber,
    );
    enqueueAdvance({
      window: command.window,
      currentCabin: command.currentCabin ?? 0,
      kind: "jump",
      slideSteps: stepsToTarget,
      animationWindow,
      fromCabin: getCurrentCabin(trainViewRef.current),
    });
    return true;
  }, []);

  const syncOverrideFromServer = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/display/override-state");
      if (!res.ok) return;
      const override = await res.json();
      if (override) setOverrideState(override as OverrideState);
    } catch {
      // ignore — banner shows reconnect state
    }
  }, []);

  const syncPlaybackFromServer = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/display/submissions");
      if (!res.ok) return;
      const data = await res.json();
      if (data.playback) {
        setIsPlaying(data.playback.isPlaying ?? true);
        clearPending();
        setTrainViewState((prev) => {
          const withCanon = initTrainView(data.submissions as Submission[]);
          const merged: TrainViewState = { ...withCanon, currentCabin: prev.currentCabin };
          return applyServerWindow(
            merged,
            (data.playback.window as TrainStep[]) ?? [],
            data.playback.currentCabin ?? 0,
          );
        });
      }
    } catch {
      // ignore — banner shows reconnect state
    }
  }, []);

  const retryBootstrap = useCallback(() => {
    setBootstrapComplete(false);
    setBootstrapError(null);
    setBootstrapAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [meRes, submissionsRes] = await Promise.all([
          fetchWithRetry("/api/auth/me"),
          fetchWithRetry("/api/display/submissions"),
        ]);
        if (cancelled) return;

        if (meRes.ok) {
          const me = await meRes.json();
          setUserRole(me.user?.role ?? null);
        }

        if (submissionsRes.ok) {
          const data = await submissionsRes.json();
          let state = initTrainView(data.submissions as Submission[]);
          if (data.playback) {
            setIsPlaying(data.playback.isPlaying ?? true);
            state = applyServerWindow(
              state,
              (data.playback.window as TrainStep[]) ?? [],
              data.playback.currentCabin ?? 0,
            );
          }
          setTrainViewState(state);
          setBootstrapError(null);
        } else {
          setBootstrapError("Could not load the display. Please try again.");
        }

        await syncOverrideFromServer();
      } catch {
        if (!cancelled) {
          setBootstrapError("Could not reach the server. Please try again.");
        }
      } finally {
        if (!cancelled) setBootstrapComplete(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [bootstrapAttempt, syncOverrideFromServer]);

  const sseHandlersRef = useRef<Record<string, (event: MessageEvent) => void>>({});
  sseHandlersRef.current = {
    submission_approved: (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      setTrainViewState((prev) => addApproved(prev, submission));
    },
    submission_edited: (event) => {
      const submission = parseSseData<Submission>(event);
      if (!submission) return;
      setTrainViewState((prev) => updateSubmissionInView(prev, submission));
    },
    submission_deleted: (event) => {
      const payload = parseSseData<{ id: string }>(event);
      if (!payload) return;
      setTrainViewState((prev) => removeSubmissionFromView(prev, payload.id));
    },
    train_command: (event) => {
      const command = parseSseData<TrainCommand>(event);
      if (!command) return;

      if (command.type === "pause") {
        setIsPlaying(false);
        clearPending();
        return;
      }
      if (command.type === "play") {
        setIsPlaying(true);
        return;
      }
      if (command.type === "advance" && command.window) {
        if (!isPlayingRef.current) return;
        enqueueAdvance({
          window: command.window,
          currentCabin: command.currentCabin ?? 0,
          kind: "advance",
        });
        return;
      }
      if (command.type === "jump" && command.window && command.cabinNumber !== undefined) {
        if (shouldDeferJumpSse(orchestratorBusyRef.current)) {
          deferredJumpRef.current = deferJumpCommand(deferredJumpRef.current, command);
          return;
        }
        clearPending();
        enqueueJumpSteps(command);
      }
    },
    train_playback_state: (event) => {
      const playback = parseSseData<ServerPlaybackState>(event);
      if (!playback) return;
      setIsPlaying(playback.isPlaying);
      if (
        !shouldApplyPlaybackStateWindow(
          pendingRef.current.length,
          orchestratorBusyRef.current,
          deferredJumpRef.current !== null,
        )
      ) return;
      clearPending();
      setTrainViewState((prev) =>
        applyServerWindow(prev, playback.window ?? [], playback.currentCabin)
      );
    },
    display_override: (event) => {
      const command = parseSseData<DisplayOverrideCommand>(event);
      if (command) {
        setOverrideState(mapCommandToOverrideState(command.type, command.imageUrl));
      }
    },
    display_reload: () => {
      clearPending();
      void syncPlaybackFromServer();
      setReloadGeneration((n) => n + 1);
    },
  };

  const connectionStatus = useReconnectingEventSource(
    "/api/display/events",
    sseHandlersRef,
    {
      enabled: bootstrapComplete,
      onReconnect: () => {
        void syncPlaybackFromServer();
        void syncOverrideFromServer();
      },
    },
  );

  async function pauseTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    clearPending();
    const ok = await publishTrainCommand({ type: "pause" });
    if (!ok) setIsPlaying(wasPlaying);
    return ok;
  }

  async function resumeTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(true);
    const ok = await publishTrainCommand({ type: "play" });
    if (!ok) setIsPlaying(wasPlaying);
    return ok;
  }

  async function jumpTrain(cabinNumber: number): Promise<boolean> {
    return publishTrainCommand({ type: "jump", cabinNumber });
  }

  return {
    trainView,
    isPlaying,
    userRole,
    currentCabin: getCurrentCabin(trainView),
    trainLength: getCanonicalCount(trainView),
    pendingAdvances,
    commitAdvance,
    peekPendingAdvance,
    hasJumpPending,
    pauseTrain,
    resumeTrain,
    jumpTrain,
    syncPlaybackFromServer,
    bootstrapComplete,
    bootstrapError,
    retryBootstrap,
    connectionStatus,
    overrideState,
    reloadGeneration,
    setOrchestratorBusy,
    flushDeferredJump,
    clearOrchestratorState,
  };
}

export type { ServerPlaybackState };
