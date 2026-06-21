import { useEffect, useRef, useState } from "preact/hooks";
import { fetchWithRetry } from "../lib/client/fetch_with_retry.ts";
import { useReconnectingEventSource } from "../lib/client/use_reconnecting_event_source.ts";
import type { Submission } from "../lib/types.ts";
import ApprovedWallList from "./ApprovedWallList.tsx";
import ConnectionBanner from "./ConnectionBanner.tsx";
import DisplayOverrideControls from "./DisplayOverrideControls.tsx";
import ModeratorTrainPanel from "./ModeratorTrainPanel.tsx";

export default function ModerateApprovedGallery() {
  const [approved, setApproved] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function loadApproved() {
    try {
      const res = await fetchWithRetry("/api/moderate/approved");
      if (!res.ok) {
        setError("Failed to load approved submissions");
        return;
      }
      setApproved(await res.json());
      setError("");
    } catch {
      setError("Could not reach the server. Please try again.");
    }
  }

  const sseHandlersRef = useRef<Record<string, (event: MessageEvent) => void>>({});
  sseHandlersRef.current = {
    submission_approved: (event) => {
      try {
        const submission = JSON.parse(event.data) as Submission;
        setApproved((prev) => [submission, ...prev.filter((s) => s.id !== submission.id)]);
      } catch {
        // ignore malformed events
      }
    },
    submission_edited: (event) => {
      try {
        const submission = JSON.parse(event.data) as Submission;
        setApproved((prev) => prev.map((s) => (s.id === submission.id ? submission : s)));
      } catch {
        // ignore malformed events
      }
    },
    submission_deleted: (event) => {
      try {
        const { id } = JSON.parse(event.data) as { id: string };
        setApproved((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // ignore malformed events
      }
    },
  };

  const connectionStatus = useReconnectingEventSource(
    "/api/moderate/events",
    sseHandlersRef,
    { onReconnect: () => void loadApproved() },
  );

  useEffect(() => {
    loadApproved().finally(() => setLoaded(true));
  }, []);

  async function showOnDisplay(cabinNumber: number): Promise<void> {
    const res = await fetch("/api/display/train-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "jump", cabinNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Jump failed");
  }

  async function apiAction(url: string, method: string): Promise<void> {
    const res = await fetch(url, { method });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
  }

  return (
    <>
      <ConnectionBanner status={connectionStatus} />
      {error && <p style="color: #c62828;">{error}</p>}
      {!loaded
        ? <p style="text-align: center; color: #666;">Loading approved…</p>
        : (
          <ApprovedWallList
            approved={approved}
            onEdit={async (sub, data) => {
              const res = await fetch(`/api/moderate/edit/${sub.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              const updated = await res.json();
              if (!res.ok) throw new Error(updated.error ?? "Edit failed");
              setApproved((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
            }}
            onDelete={async (sub) => {
              await apiAction(`/api/moderate/delete/${sub.id}`, "POST");
              setApproved((prev) => prev.filter((s) => s.id !== sub.id));
            }}
            onShowOnDisplay={showOnDisplay}
          />
        )}
    </>
  );
}
