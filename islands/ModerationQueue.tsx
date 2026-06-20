import { useEffect, useState } from "preact/hooks";
import { highlightFlaggedWords } from "../lib/moderation/highlight_flagged_words.ts";
import type { Submission } from "../lib/types.ts";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function MessageText({ message, flaggedWords }: { message: string; flaggedWords?: string[] }) {
  const segments = highlightFlaggedWords(message, flaggedWords ?? []);
  return (
    <p style="margin: 0.5rem 0; line-height: 1.5;">
      {segments.map((seg, i) =>
        seg.highlighted
          ? (
            <mark
              key={i}
              style="background: #ffe0e0; color: #c41e3a; text-decoration: underline;"
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
}: {
  submission: Submission;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: (data: { message: string; submitter_name: string; social_handle: string }) => void;
  onDelete?: () => void;
  onShowOnDisplay?: () => void;
  showDelete?: boolean;
  cabinNumber?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(submission.message);
  const [submitterName, setSubmitterName] = useState(submission.submitter_name);
  const [socialHandle, setSocialHandle] = useState(submission.social_handle ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const flaggedStyle = submission.is_flagged
    ? "border: 2px solid #f0ad4e; background: #fff8e6;"
    : "border: 1px solid #ddd; background: white;";

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
      style={`padding: 1rem; border-radius: 8px; margin-bottom: 1rem; ${flaggedStyle}`}
    >
      {submission.is_flagged && (
        <p style="margin: 0 0 0.5rem; color: #b8860b; font-weight: 600;">
          ⚠ Flagged for review
          {submission.flagged_words?.length
            ? ` (${submission.flagged_words.join(", ")})`
            : ""}
        </p>
      )}
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <img
          src={submission.image_url}
          alt="Submission"
          style="width: 120px; height: 120px; object-fit: cover; border-radius: 4px;"
        />
        <div style="flex: 1; min-width: 200px;">
          {editing
            ? (
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <textarea
                  value={message}
                  onInput={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
                  rows={3}
                  aria-label="Submission message"
                  style="width: 100%; padding: 0.5rem;"
                />
                <input
                  type="text"
                  value={submitterName}
                  onInput={(e) => setSubmitterName((e.target as HTMLInputElement).value)}
                  placeholder="Name"
                  aria-label="Submitter name"
                  style="padding: 0.5rem;"
                />
                <input
                  type="text"
                  value={socialHandle}
                  onInput={(e) => setSocialHandle((e.target as HTMLInputElement).value)}
                  placeholder="Social handle"
                  aria-label="Social handle"
                  style="padding: 0.5rem;"
                />
                <div style="display: flex; gap: 0.5rem;">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveEdit}
                    style="padding: 0.4rem 0.8rem; background: #ef3340; color: white; border: none; border-radius: 4px; cursor: pointer;"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(false)}
                    style="padding: 0.4rem 0.8rem; background: #ccc; border: none; border-radius: 4px; cursor: pointer;"
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
                <p style="margin: 0.25rem 0; font-size: 0.9rem;">
                  <strong>{submission.submitter_name}</strong>
                  {submission.social_handle && ` · ${submission.social_handle}`}
                </p>
                <p style="margin: 0; font-size: 0.8rem; color: #666;">
                  {formatTime(submission.created_at)}
                </p>
                {submission.edit_count > 0 && (
                  <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: #666; font-style: italic;">
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
        <div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
          {onApprove && (
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              style="padding: 0.4rem 0.8rem; background: #2e7d32; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              type="button"
              disabled={busy}
              onClick={handleReject}
              style="padding: 0.4rem 0.8rem; background: #c62828; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Reject
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              style="padding: 0.4rem 0.8rem; background: #1565c0; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Edit
            </button>
          )}
          {showDelete && onDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              style="padding: 0.4rem 0.8rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Delete
            </button>
          )}
          {onShowOnDisplay && cabinNumber !== undefined && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onShowOnDisplay()}
              style="padding: 0.4rem 0.8rem; background: #6a1b9a; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Show on display (cabin {cabinNumber})
            </button>
          )}
        </div>
      )}
      {error && <p style="color: #c62828; margin: 0.5rem 0 0; font-size: 0.9rem;">{error}</p>}
    </article>
  );
}

export default function ModerationQueue() {
  const [pending, setPending] = useState<Submission[]>([]);
  const [approved, setApproved] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function loadQueues() {
    const [pendingRes, approvedRes] = await Promise.all([
      fetch("/api/moderate/pending"),
      fetch("/api/moderate/approved"),
    ]);
    if (!pendingRes.ok || !approvedRes.ok) {
      setError("Failed to load moderation queue");
      return;
    }
    setPending(await pendingRes.json());
    setApproved(await approvedRes.json());
    setError("");
  }

  useEffect(() => {
    loadQueues().finally(() => setLoaded(true));
    const es = new EventSource("/api/moderate/events");

    const parseSubmission = (event: MessageEvent): Submission | null => {
      try {
        return JSON.parse(event.data) as Submission;
      } catch {
        return null;
      }
    };

    es.addEventListener("submission_created", (event) => {
      const submission = parseSubmission(event);
      if (!submission) return;
      setPending((prev) => [submission, ...prev.filter((s) => s.id !== submission.id)]);
    });

    es.addEventListener("submission_approved", (event) => {
      const submission = parseSubmission(event);
      if (!submission) return;
      setPending((prev) => prev.filter((s) => s.id !== submission.id));
      setApproved((prev) => [submission, ...prev.filter((s) => s.id !== submission.id)]);
    });

    es.addEventListener("submission_rejected", (event) => {
      try {
        const { id } = JSON.parse(event.data) as { id: string };
        setPending((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener("submission_edited", (event) => {
      const submission = parseSubmission(event);
      if (!submission) return;
      setPending((prev) => prev.map((s) => (s.id === submission.id ? submission : s)));
      setApproved((prev) => prev.map((s) => (s.id === submission.id ? submission : s)));
    });

    es.addEventListener("submission_deleted", (event) => {
      try {
        const { id } = JSON.parse(event.data) as { id: string };
        setApproved((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => es.close();

    return () => es.close();
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
    return <p style="text-align: center; color: #666;">Loading queue…</p>;
  }

  return (
    <div>
      {error && <p style="color: #c62828;">{error}</p>}

      <h3 style="color: #ef3340;">Pending submissions</h3>
      {pending.length === 0
        ? <p style="color: #666;">No pending submissions</p>
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

      <h3 style="color: #ef3340; margin-top: 2rem;">Approved on wall</h3>
      {approved.length === 0
        ? <p style="color: #666;">No approved submissions</p>
        : approved.map((sub, index) => (
          <SubmissionCard
            key={sub.id}
            submission={sub}
            showDelete
            cabinNumber={index + 1}
            onEdit={async (data) => {
              const res = await fetch(`/api/moderate/edit/${sub.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              const updated = await res.json();
              if (!res.ok) throw new Error(updated.error ?? "Edit failed");
              setApproved((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
            }}
            onDelete={async () => {
              await apiAction(`/api/moderate/delete/${sub.id}`, "POST");
              setApproved((prev) => prev.filter((s) => s.id !== sub.id));
            }}
            onShowOnDisplay={async () => {
              await showOnDisplay(index + 1);
            }}
          />
        ))}
    </div>
  );
}
