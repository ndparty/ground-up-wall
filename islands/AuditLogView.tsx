import { useEffect, useState } from "preact/hooks";
import type { AuditEntry } from "../lib/types.ts";

const PAGE_SIZE = 50;

const ACTION_TYPES = [
  "approve",
  "reject",
  "edit",
  "delete",
  "submit",
  "change_config",
  "create_moderator",
  "disable_moderator",
  "enable_moderator",
  "delete_moderator",
  "reset_password",
  "create_display_wall_user",
  "disable_display_wall_user",
  "enable_display_wall_user",
  "delete_display_wall_user",
  "blank_display",
  "show_placeholder",
  "set_default_placeholder",
  "resume_display",
  "reload_display",
  "panic_display",
  "change_password",
  "login_failed",
];

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [moderatorId, setModeratorId] = useState("");
  const [actionType, setActionType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load(pageOffset = offset) {
    const params = new URLSearchParams();
    if (moderatorId) params.set("moderator_id", moderatorId);
    if (actionType) params.set("action_type", actionType);
    if (targetType) params.set("target_type", targetType);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(pageOffset));
    const res = await fetch(`/api/towkay/audit-log?${params}`);
    if (res.ok) {
      const body = await res.json() as { entries: AuditEntry[]; total: number };
      setEntries(body.entries);
      setTotal(body.total);
      setOffset(pageOffset);
    }
  }

  useEffect(() => {
    load(0);
  }, []);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + entries.length, total);

  return (
    <div>
      <div class="filter-bar">
        <input
          placeholder="Moderator ID"
          aria-label="Filter by moderator ID"
          value={moderatorId}
          onInput={(e) => setModeratorId((e.target as HTMLInputElement).value)}
        />
        <select
          aria-label="Filter by action type"
          value={actionType}
          onChange={(e) => setActionType((e.target as HTMLSelectElement).value)}
        >
          <option value="">All actions</option>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          aria-label="Filter by target type"
          value={targetType}
          onChange={(e) => setTargetType((e.target as HTMLSelectElement).value)}
        >
          <option value="">All targets</option>
          <option value="submission">submission</option>
          <option value="moderator">moderator</option>
          <option value="display_wall_user">display_wall_user</option>
          <option value="system_config">system_config</option>
          <option value="display_override">display_override</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          value={dateFrom}
          onInput={(e) => setDateFrom((e.target as HTMLInputElement).value)}
        />
        <input
          type="date"
          aria-label="To date"
          value={dateTo}
          onInput={(e) => setDateTo((e.target as HTMLInputElement).value)}
        />
        <button type="button" class="btn btn--primary" onClick={() => load(0)}>Apply filters</button>
      </div>

      {total > 0 && (
        <div class="pagination-bar">
          <span class="text-muted">
            Showing {pageStart}–{pageEnd} of {total}
          </span>
          <button
            type="button"
            class="btn btn--ghost"
            disabled={offset <= 0}
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => load(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      )}

      {entries.length === 0
        ? <p class="text-muted">No audit log entries found</p>
        : (
          <table class="data-table data-table--compact">
            <thead>
              <tr class="data-table__head">
                <th class="data-table__cell">Timestamp</th>
                <th>Moderator</th>
                <th>Action</th>
                <th>Target</th>
                <th>Old</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} class="data-table__row">
                  <td class="data-table__cell">{new Date(e.timestamp).toISOString()}</td>
                  <td>{e.moderator_username ?? e.moderator_id}</td>
                  <td>{e.action_type}</td>
                  <td>{e.target_type}:{e.target_id}</td>
                  <td class="data-table__cell--truncate">
                    {e.old_value ?? "—"}
                  </td>
                  <td class="data-table__cell--truncate">
                    {e.new_value ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
