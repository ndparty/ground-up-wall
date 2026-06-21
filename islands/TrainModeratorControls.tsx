import TrainControls from "./TrainControls.tsx";

export interface TrainModeratorControlsProps {
  trainLength: number;
  currentCabin: number;
  isPlaying: boolean;
}

async function publishTrainCommand(body: unknown): Promise<boolean> {
  const res = await fetch("/api/display/train-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export default function TrainModeratorControls({
  trainLength,
  currentCabin,
  isPlaying,
}: TrainModeratorControlsProps) {
  async function pauseTrain() {
    await publishTrainCommand({ type: "pause" });
  }

  async function resumeTrain() {
    await publishTrainCommand({ type: "play" });
  }

  async function jumpTrain(cabinNumber: number) {
    await publishTrainCommand({ type: "jump", cabinNumber });
  }

  if (trainLength === 0) {
    return <p style="color: #666;">No approved submissions on the display yet.</p>;
  }

  return (
    <section
      class="moderate-train-panel"
      style="margin-bottom: 2rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;"
    >
      <h3 style="margin: 0 0 0.75rem; color: #ef3340;">Display train controls</h3>
      <link rel="stylesheet" href="/train.css" />
      <TrainControls
        variant="moderate"
        isPlaying={isPlaying}
        onPause={pauseTrain}
        onPlay={resumeTrain}
        onJump={jumpTrain}
        trainLength={trainLength}
        currentCabin={currentCabin}
      />
    </section>
  );
}
