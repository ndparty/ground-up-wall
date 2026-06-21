import { useEffect, useRef, useState } from "preact/hooks";
import { fetchWithRetry } from "../lib/client/fetch_with_retry.ts";
import { useReconnectingEventSource } from "../lib/client/use_reconnecting_event_source.ts";
import ConnectionBanner from "./ConnectionBanner.tsx";
import { highlightFlaggedWords } from "../lib/moderation/highlight_flagged_words.ts";
import type { Submission } from "../lib/types.ts";
import ApprovedWallList from "./ApprovedWallList.tsx";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function MessageText({ message, flaggedWords }: { message: string; flaggedWords?: string[] }) {
  const segments = highlightFlaggedWords(message, flaggedWords ?? []);
  return (
    <p class="submission-card__message">
      {segments.map((seg, i) =>
        seg.highlighted
          ? (
            <mark
              key={i}
              class="submission-card__highlight"
            >
              {seg.text}
            </mark>
          )
          : <span key={i}>{seg.text}</span>
      )}
    </p>
  );
}

function SubmissionCard({
  submission,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onShowOnDisplay,
  showDelete,
  cabinNumber,
  lazyImage,
}: {
  submission: Submission;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: (data: { message: string; submitter_name: string; social_handle: string }) => void;
  onDelete?: () => void;
  onShowOnDisplay?: () => void;
  showDelete?: boolean;
  cabinNumber?: number;
  lazyImage?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(submission.message);
  const [submitterName, setSubmitterName] = useState(submission.submitter_name);
  const [socialHandle, setSocialHandle] = useState(submission.social_handle ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleReject() {
    if (!globalThis.confirm("Reject this submission?")) return;
    setBusy(true);
    setError("");
    try {
      await onReject?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      await onApprove?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    setBusy(true);
    setError("");
    try {
      await onEdit?.({
        message,
        submitter_name: submitterName,
        social_handle: socialHandle,
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!globalThis.confirm("Delete this approved submission from the wall?")) return;
    setBusy(true);
    setError("");
    try {
      await onDelete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      class={`submission-card ${submission.is_flagged ? "submission-card--flagged" : ""}`}
    >
      {submission.is_flagged && (
        <p class="submission-card__flag">
          ⚠ Flagged for review
          {submission.flagged_words?.length ? ` (${submission.flagged_words.join(", ")})` : ""}
        </p>
      )}
      <div class="submission-card__body">
        <img
          src={submission.image_url}
          alt="Submission"
          loading={lazyImage ? "lazy" : undefined}
          class="submission-card__thumb"
        />
        <div class="submission-card__content">
          {editing
            ? (
              <div class="form-stack">
                <textarea
                  value={message}
                  onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
                  rows={3}
                  aria-label="Submission message"
                  class="submission-card__textarea"
                />
                <input
                  type="text"
                  value={submitterName}
                  onInput={(e) => setSubmitterName((e.target as HTMLInputElement).value)}
                  placeholder="Name"
                  aria-label="Submitter name"
                  class="submission-card__input"
                />
                <input
                  type="text"
                  value={socialHandle}
                  onInput={(e) => setSocialHandle((e.target as HTMLInputElement).value)}
                  placeholder="Social handle"
                  aria-label="Social handle"
                  class="submission-card__input"
                />
                <div class="form-row--actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveEdit}
                    class="btn btn--danger"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(false)}
                    class="btn btn--cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
            : (
              <>
                <MessageText
                  message={submission.message}
                  flaggedWords={submission.flagged_words}
                />
                <p class="submission-card__meta">
                  <strong>{submission.submitter_name}</strong>
                  {submission.social_handle && ` · ${submission.social_handle}`}
                </p>
                <p class="submission-card__time">
                  {formatTime(submission.created_at)}
                </p>
                {submission.edit_count > 0 && (
                  <p class="submission-card__edited">
                    Edited{submission.edited_by
                      ? ` (moderator ${submission.edited_by_username ?? submission.edited_by})`
                      : ""}
                    {submission.edit_count > 1 ? ` · ${submission.edit_count} edits` : ""}
                  </p>
                )}
              </>
            )}
        </div>
      </div>
      {!editing && (
        <div class="submission-card__actions">
          {onApprove && (
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              class="btn btn--approve"
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              type="button"
              disabled={busy}
              onClick={handleReject}
              class="btn btn--reject"
            >
              Reject
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              class="btn btn--edit"
            >
              Edit
            </button>
          )}
          {showDelete && onDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              class="btn btn--dark"
            >
              Delete
            </button>
          )}
          {onShowOnDisplay && cabinNumber !== undefined && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onShowOnDisplay()}
              class="btn btn--purple"
            >
              Show on display (cabin {cabinNumber})
            </button>
          )}
        </div>
      )}
      {error && <p class="submission-card__error">{error}</p>}
    </article>
  );
}

export { SubmissionCard };

export default function ModerationQueue() {
  const [pending, setPending] = useState<Submission[]>([]);
  const [approved, setApproved] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  function parseSubmission(event: MessageEvent): Submission | null {
    try {
      return JSON.parse(event.data) as Submission;
    } catch {
      return null;
    }
  }

  async function loadQueues() {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        fetchWithRetry("/api/moderate/pending"),
        fetchWithRetry("/api/moderate/approved"),
      ]);
      if (!pendingRes.ok || !approvedRes.ok) {
        setError("Failed to load moderation queue");
        return;
      }
      setPending(await pendingRes.json());
      setApproved(await approvedRes.json());
      setError("");
    } catch {
      setError("Could not reach the server. Please try again.");
    }
  }

  const sseHandlersRef = useRef<Record<string, (event: MessageEvent) => void>>({});
  sseHandlersRef.current = {
    submission_created: (event) => {
      const submission = parseSubmission(event);
      if (!submission) return;
      setPending((prev) => [...prev.filter((s) => s.id !== submission.id), submission]);
    },
    submission_approved: (event) => {
      const submission = parseSubmission(event);
      if (!submission) return;
      setPending((prev) => prev.filter((s) => s.id !== submission.id));
      setApproved((prev) => [submission, ...prev.filter((s) => s.id !== submission.id)]);
    },
    submission_rejected: (event) => {
      try {
        const { id } = JSON.parse(event.data) as { id: string };
        setPending((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // ignore malformed events
      }
    },
    submission_edited: (event) => {
      const submission = parseSubmission(event);
      if (!submission) return;
      setPending((prev) => prev.map((s) => (s.id === submission.id ? submission : s)));
      setApproved((prev) => prev.map((s) => (s.id === submission.id ? submission : s)));
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
    { onReconnect: () => void loadQueues() },
  );

  useEffect(() => {
    loadQueues().finally(() => setLoaded(true));
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

  async function apiAction(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<void> {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
  }

  if (!loaded) {
    return <p class="text-loading">Loading queue…</p>;
  }

  return (
    <div>
      <ConnectionBanner status={connectionStatus} />
      {error && <p class="text-error--block">{error}</p>}

      <h3 class="heading-section">Pending submissions</h3>
      {pending.length === 0
        ? <p class="text-muted">No pending submissions</p>
        : pending.map((sub) => (
          <SubmissionCard
            key={sub.id}
            submission={sub}
            onApprove={async () => {
              await apiAction(`/api/moderate/approve/${sub.id}`, "POST");
              setPending((prev) => prev.filter((s) => s.id !== sub.id));
              const res = await fetch("/api/moderate/approved");
              if (res.ok) setApproved(await res.json());
            }}
            onReject={async () => {
              await apiAction(`/api/moderate/reject/${sub.id}`, "POST");
              setPending((prev) => prev.filter((s) => s.id !== sub.id));
            }}
            onEdit={async (data) => {
              const res = await fetch(`/api/moderate/edit/${sub.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              const updated = await res.json();
              if (!res.ok) throw new Error(updated.error ?? "Edit failed");
              setPending((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
            }}
          />
        ))}

      <h3 class="heading-section--spaced">Approved on wall</h3>
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
    </div>
  );
}
