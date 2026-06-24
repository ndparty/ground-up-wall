import { useEffect, useRef, useState } from "preact/hooks";
import { fetchWithRetry } from "../lib/client/fetch_with_retry.ts";
import { useReconnectingEventSource } from "../lib/client/use_reconnecting_event_source.ts";
import TrainModeratorControls from "./TrainModeratorControls.tsx";

interface DisplayPlayback {
  trainLength: number;
  currentCabin: number;
  isPlaying: boolean;
}

export default function ModeratorTrainPanel() {
  const [playback, setPlayback] = useState<DisplayPlayback>({
    trainLength: 0,
    currentCabin: 0,
    isPlaying: true,
  });

  async function loadPlayback() {
    try {
      const res = await fetchWithRetry("/api/concourse/submissions");
      if (!res.ok) return;
      const data = await res.json();
      setPlayback({
        trainLength: (data.submissions as unknown[]).length,
        currentCabin: data.playback?.currentCabin ?? 0,
        isPlaying: data.playback?.isPlaying ?? true,
      });
    } catch {
      // ignore — SSE reconnect will retry
    }
  }

  const sseHandlersRef = useRef<Record<string, (event: MessageEvent) => void>>({});
  sseHandlersRef.current = {
    train_playback_state: () => void loadPlayback(),
    train_command: () => void loadPlayback(),
    submission_approved: () => void loadPlayback(),
    submission_deleted: () => void loadPlayback(),
  };

  useReconnectingEventSource("/api/concourse/events", sseHandlersRef, {
    onReconnect: () => void loadPlayback(),
  });

  useEffect(() => {
    loadPlayback().catch(() => undefined);
  }, []);

  return (
    <TrainModeratorControls
      trainLength={playback.trainLength}
      currentCabin={playback.currentCabin}
      isPlaying={playback.isPlaying}
    />
  );
}
