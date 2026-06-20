import { useEffect, useState } from "preact/hooks";
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
    const res = await fetch("/api/display/submissions");
    if (!res.ok) return;
    const data = await res.json();
    setPlayback({
      trainLength: (data.submissions as unknown[]).length,
      currentCabin: data.playback?.currentCabin ?? 0,
      isPlaying: data.playback?.isPlaying ?? true,
    });
  }

  useEffect(() => {
    loadPlayback().catch(() => undefined);
    const es = new EventSource("/api/display/events");
    es.addEventListener("train_playback_state", () => void loadPlayback());
    es.addEventListener("train_command", () => void loadPlayback());
    es.addEventListener("submission_approved", () => void loadPlayback());
    es.addEventListener("submission_deleted", () => void loadPlayback());
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  return (
    <TrainModeratorControls
      trainLength={playback.trainLength}
      currentCabin={playback.currentCabin}
      isPlaying={playback.isPlaying}
    />
  );
}
