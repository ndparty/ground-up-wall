import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { fetchWithRetry } from "../client/fetch_with_retry.ts";
import { redirectToLogin, useDisplaySessionKeepalive } from "../client/use_display_session_keepalive.ts";
import { useReconnectingEventSource } from "../client/use_reconnecting_event_source.ts";
import type { ConnectionStatus } from "../client/use_reconnecting_event_source.ts";
import type {
  DisplayOverrideCommand,
  TrainCommand,
  TrainStep,
} from "../interfaces/realtime_service.ts";
import type { Submission, User } from "../types.ts";
import { mapCommandToOverrideState, type OverrideState } from "./display_override.ts";
import {
  type PublicParticipantUrl,
  resolvePublicParticipantUrl,
} from "../display/public_participant_url.ts";
import {
  applyServerWindow,
  getCanonicalCount,
  getCurrentCabin,
  initTrainView,
  addApproved,
  removeSubmissionFromView,
  type TrainViewState,
  updateSubmissionInView,
} from "./train_view.ts";
import { CENTER_SLOT } from "./train_view_constants.ts";
import { windowsIdentityEqual } from "./tape_helpers.ts";

interface ServerPlaybackState {
  isPlaying: boolean;
  currentCabin: number;
  dwellSeconds?: number;
  lastTransitionAt?: number;
  window?: TrainStep[];
}

export interface LatestTarget {
  window: TrainStep[];
  currentCabin: number;
  allowWhilePaused: boolean;
}

export interface CommitReconcileResult {
  view: TrainViewState;
  centerKey: string | null;
}

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

function viewToSteps(view: TrainViewState): TrainStep[] {
  return view.window.map((c) => ({
    seq: Number.parseInt(c.key.slice(1), 10),
    kind: c.kind,
    submissionId: c.submission?.id,
    destination: c.destination,
    ephemeral: c.ephemeral,
  }));
}
function maxSeqInSteps(steps: TrainStep[]): number {
  return steps.reduce((max, s) => Math.max(max, s.seq), 0);
}

export interface UseTrainPlaybackResult {
  trainView: TrainViewState;
  isPlaying: boolean;
  userRole: User["role"] | null;
  currentCabin: number;
  trainLength: number;
  reconcileGeneration: number;
  commitReconciled: (committedWindow: TrainStep[], currentCabin: number) => CommitReconcileResult;
  peekLatestTarget: () => LatestTarget | null;
  latestGenerationRef: { current: number };
  nextClientSeq: () => number;
  pauseTrain: () => Promise<boolean>;
  resumeTrain: () => Promise<boolean>;
  jumpTrain: (cabinNumber: number) => Promise<boolean>;
  syncPlaybackFromServer: () => Promise<void>;
  reconcileFromServer: () => Promise<void>;
  bootstrapComplete: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => void;
  connectionStatus: ConnectionStatus;
  overrideState: OverrideState;
  reloadGeneration: number;
  publicParticipantUrl: PublicParticipantUrl | null;
  setOrchestratorBusy: (busy: boolean) => void;
  clearOrchestratorState: () => void;
  acknowledgeReconcileCatchUp: () => void;
}

async function publishTrainCommand(command: TrainCommand): Promise<boolean> {
  const res = await fetch("/api/concourse/train-command", {
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
  const [reconcileGeneration, setReconcileGeneration] = useState(0);
  const [overrideState, setOverrideState] = useState<OverrideState>({ type: "normal" });
  const [reloadGeneration, setReloadGeneration] = useState(0);
  const [publicParticipantUrl, setPublicParticipantUrl] = useState<PublicParticipantUrl | null>(
    null,
  );

  const isPlayingRef = useRef(isPlaying);
  const latestTargetRef = useRef<LatestTarget | null>(null);
  const latestGenerationRef = useRef(0);
  const clientSeqCounterRef = useRef(0);
  const trainViewRef = useRef(trainView);
  const orchestratorBusyRef = useRef(false);
  isPlayingRef.current = isPlaying;
  trainViewRef.current = trainView;

  function seedClientSeqFromSteps(steps: TrainStep[]): void {
    clientSeqCounterRef.current = Math.max(
      clientSeqCounterRef.current,
      maxSeqInSteps(steps),
    );
  }

  function bumpReconcile(
    window: TrainStep[],
    currentCabin: number,
    allowWhilePaused: boolean,
  ): void {
    seedClientSeqFromSteps(window);
    latestTargetRef.current = { window, currentCabin, allowWhilePaused };
    latestGenerationRef.current += 1;
    setReconcileGeneration(latestGenerationRef.current);
  }

  function clearLatestTarget(): void {
    latestTargetRef.current = null;
  }

  const nextClientSeq = useCallback((): number => {
    clientSeqCounterRef.current += 1;
    return clientSeqCounterRef.current;
  }, []);

  const commitReconciled = useCallback((
    committedWindow: TrainStep[],
    currentCabin: number,
  ): CommitReconcileResult => {
    const updated = applyServerWindow(trainViewRef.current, committedWindow, currentCabin);
    trainViewRef.current = updated;
    setTrainViewState(updated);
    seedClientSeqFromSteps(committedWindow);
    return { view: updated, centerKey: centerKeyFromWindow(committedWindow) };
  }, []);

  const peekLatestTarget = useCallback((): LatestTarget | null => {
    return latestTargetRef.current;
  }, []);

  const setOrchestratorBusy = useCallback((busy: boolean): void => {
    orchestratorBusyRef.current = busy;
  }, []);

  const clearOrchestratorState = useCallback((): void => {
    orchestratorBusyRef.current = false;
    clearLatestTarget();
  }, []);

  const acknowledgeReconcileCatchUp = useCallback((): void => {
    clearLatestTarget();
  }, []);

  const syncOverrideFromServer = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/concourse/override-state");
      if (!res.ok) return;
      const override = await res.json();
      if (override) setOverrideState(override as OverrideState);
    } catch {
      // ignore — banner shows reconnect state
    }
  }, []);

  const syncPlaybackFromServer = useCallback(async () => {
    if (orchestratorBusyRef.current || latestTargetRef.current !== null) return;
    try {
      const res = await fetchWithRetry("/api/concourse/submissions");
      if (!res.ok) return;
      const data = await res.json();
      if (data.playback) {
        setIsPlaying(data.playback.isPlaying ?? true);
        clearLatestTarget();
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

  const reconcileFromServer = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/concourse/submissions");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.playback?.window) return;

      setIsPlaying(data.playback.isPlaying ?? true);
      setTrainViewState((prev) => ({
        ...initTrainView(data.submissions as Submission[]),
        window: prev.window,
        currentCabin: prev.currentCabin,
      }));
      bumpReconcile(
        data.playback.window as TrainStep[],
        data.playback.currentCabin ?? 0,
        false,
      );
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
          fetchWithRetry("/api/masuk/me"),
          fetchWithRetry("/api/concourse/submissions"),
        ]);
        if (cancelled) return;

        if (meRes.ok) {
          const me = await meRes.json();
          setUserRole(me.user?.role ?? null);
        } else if (meRes.status === 401) {
          redirectToLogin();
          return;
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
            seedClientSeqFromSteps(state.window.map((c) => ({
              seq: Number.parseInt(c.key.slice(1), 10),
              kind: c.kind,
              submissionId: c.submission?.id,
              destination: c.destination,
              ephemeral: c.ephemeral,
            })));
          }
          setTrainViewState(state);
          setBootstrapError(null);
          if (data.publicParticipantUrl) {
            setPublicParticipantUrl(data.publicParticipantUrl as PublicParticipantUrl);
          } else {
            setPublicParticipantUrl(null);
          }
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
        if (!orchestratorBusyRef.current) clearLatestTarget();
        return;
      }
      if (command.type === "play") {
        setIsPlaying(true);
        latestGenerationRef.current += 1;
        setReconcileGeneration(latestGenerationRef.current);
        return;
      }
      if (command.type === "advance" && command.window) {
        if (!isPlayingRef.current) return;
        bumpReconcile(command.window, command.currentCabin ?? 0, false);
        return;
      }
      if (command.type === "jump" && command.window && command.cabinNumber !== undefined) {
        bumpReconcile(command.window, command.currentCabin ?? 0, true);
      }
    },
    train_playback_state: (event) => {
      const playback = parseSseData<ServerPlaybackState>(event);
      if (!playback) return;
      setIsPlaying(playback.isPlaying);
      if (orchestratorBusyRef.current || !playback.window?.length) return;
      if (windowsIdentityEqual(viewToSteps(trainViewRef.current), playback.window)) return;
      bumpReconcile(playback.window, playback.currentCabin ?? 0, false);
    },
    display_override: (event) => {
      const command = parseSseData<DisplayOverrideCommand>(event);
      if (command) {
        setOverrideState(mapCommandToOverrideState(command.type, command.imageUrl));
      }
    },
    display_reload: () => {
      clearLatestTarget();
      void syncPlaybackFromServer();
      setReloadGeneration((n) => n + 1);
    },
    system_config_changed: (event) => {
      const cfg = parseSseData<{ key: string; value: string }>(event);
      if (!cfg || cfg.key !== "public_participant_url") return;
      setPublicParticipantUrl(resolvePublicParticipantUrl(cfg.value));
    },
  };

  const connectionStatus = useReconnectingEventSource(
    "/api/concourse/events",
    sseHandlersRef,
    {
      enabled: bootstrapComplete,
      onReconnect: () => {
        void reconcileFromServer();
        void syncOverrideFromServer();
      },
    },
  );

  useDisplaySessionKeepalive(bootstrapComplete);

  async function pauseTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    if (!orchestratorBusyRef.current) clearLatestTarget();
    const ok = await publishTrainCommand({ type: "pause" });
    if (!ok) setIsPlaying(wasPlaying);
    return ok;
  }

  async function resumeTrain(): Promise<boolean> {
    const wasPlaying = isPlaying;
    setIsPlaying(true);
    latestGenerationRef.current += 1;
    setReconcileGeneration(latestGenerationRef.current);
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
    reconcileGeneration,
    commitReconciled,
    peekLatestTarget,
    latestGenerationRef,
    nextClientSeq,
    pauseTrain,
    resumeTrain,
    jumpTrain,
    syncPlaybackFromServer,
    reconcileFromServer,
    bootstrapComplete,
    bootstrapError,
    retryBootstrap,
    connectionStatus,
    overrideState,
    reloadGeneration,
    publicParticipantUrl,
    setOrchestratorBusy,
    clearOrchestratorState,
    acknowledgeReconcileCatchUp,
  };
}

export type { ServerPlaybackState };
