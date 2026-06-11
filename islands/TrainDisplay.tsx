import { useEffect, useRef, useState } from "preact/hooks";
import {
  addSubmission,
  cloneChain,
  initTrain,
  removeSubmission,
  transitionToNext,
  updateSubmission,
  type TrainChain,
} from "../lib/train/chain.ts";
import { clampDwellSeconds } from "../lib/train/display_helpers.ts";
import type { Submission } from "../lib/types.ts";
import TrainCabin from "./TrainCabin.tsx";

const CABIN_STEP_PX = 512; // --cabin-width + --cabin-gap

export default function TrainDisplay() {
  const [chain, setChain] = useState<TrainChain>(() => initTrain([]));
  const [dwellTime, setDwellTime] = useState(15);
  const [isPlaying] = useState(true);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const chainRef = useRef(chain);
  chainRef.current = chain;

  const currentIndex = chain.current?.index ?? 0;
  const hasCabins = chain.nodes.length > 0;

  useEffect(() => {
    const dismissed = globalThis.localStorage?.getItem("display_wall_fullscreen_dismissed");
    if (!dismissed) setShowFullscreenPrompt(true);
    document.body.classList.add("display-wall-mode");
    return () => document.body.classList.remove("display-wall-mode");
  }, []);

  useEffect(() => {
    fetch("/api/display/submissions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setDwellTime(clampDwellSeconds(data.dwellTimeSeconds ?? 15));
        setChain(initTrain(data.submissions as Submission[]));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/display/events");

    es.addEventListener("submission_approved", (event) => {
      const submission = JSON.parse(event.data) as Submission;
      setChain((prev) => {
        const next = cloneChain(prev);
        addSubmission(next, submission);
        return { ...next, nodes: [...next.nodes] };
      });
    });

    es.addEventListener("submission_edited", (event) => {
      const submission = JSON.parse(event.data) as Submission;
      setChain((prev) => {
        const next = cloneChain(prev);
        updateSubmission(next, submission);
        return { ...next, nodes: [...next.nodes] };
      });
    });

    es.addEventListener("submission_deleted", (event) => {
      const { id } = JSON.parse(event.data) as { id: string };
      setChain((prev) => {
        const next = cloneChain(prev);
        removeSubmission(next, id);
        return { ...next, nodes: [...next.nodes] };
      });
    });

    return () => es.close();
  }, []);

  useEffect(() => {
    if (!isPlaying || !hasCabins) return;
    const timer = setTimeout(() => {
      setChain((prev) => {
        const next = cloneChain(prev);
        transitionToNext(next);
        return { ...next, nodes: [...next.nodes] };
      });
    }, dwellTime * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, dwellTime, currentIndex, hasCabins]);

  function dismissFullscreenPrompt() {
    globalThis.localStorage?.setItem("display_wall_fullscreen_dismissed", "1");
    setShowFullscreenPrompt(false);
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen requires user gesture; ignore NotAllowedError
    }
    dismissFullscreenPrompt();
  }

  const translateX = -currentIndex * CABIN_STEP_PX;

  return (
    <div class="display-wall">
      <link rel="stylesheet" href="/train.css" />

      {showFullscreenPrompt && (
        <div class="display-wall__fullscreen-prompt">
          <button type="button" onClick={enterFullscreen}>
            Click to go fullscreen
          </button>
        </div>
      )}

      {!hasCabins
        ? (
          <div class="display-wall__empty">
            <h2>🇸🇬 Ground Up Wall</h2>
            <p>Submissions coming soon!</p>
          </div>
        )
        : (
          <div class="display-wall__track-wrap">
            <div
              class="display-wall__track"
              style={{ transform: `translateX(${translateX}px)` }}
            >
              {chain.nodes.map((node) => (
                <TrainCabin
                  key={node.submission.id}
                  submission={node.submission}
                  isActive={node.index === currentIndex}
                  index={node.index}
                />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
