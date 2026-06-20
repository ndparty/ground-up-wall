import { useEffect, useState } from "preact/hooks";
import type { AuditEntry } from "../lib/types.ts";

const ACTION_TYPES = [
  "approve", "reject", "edit", "delete", "submit", "change_config",
  "create_moderator", "disable_moderator", "enable_moderator", "delete_moderator",
  "reset_password", "create_display_wall_user", "disable_display_wall_user",
  "enable_display_wall_user", "delete_display_wall_user",
  "blank_display", "show_placeholder", "resume_display", "change_password", "login_failed",
];

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [moderatorId, setModeratorId] = useState("");
  const [actionType, setActionType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (moderatorId) params.set("moderator_id", moderatorId);
    if (actionType) params.set("action_type", actionType);
    if (targetType) params.set("target_type", targetType);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const res = await fetch(`/api/admin/audit-log?${params}`);
    if (res.ok) setEntries(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div
        style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: end;"
      >
        <input
          placeholder="Moderator ID"
          value={moderatorId}
          onInput={(e) => setModeratorId((e.target as HTMLInputElement).value)}
        />
        <select value={actionType} onChange={(e) => setActionType((e.target as HTMLSelectElement).value)}>
          <option value="">All actions</option>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={targetType} onChange={(e) => setTargetType((e.target as HTMLSelectElement).value)}>
          <option value="">All targets</option>
          <option value="submission">submission</option>
          <option value="moderator">moderator</option>
          <option value="display_wall_user">display_wall_user</option>
          <option value="system_config">system_config</option>
          <option value="display_override">display_override</option>
        </select>
        <input type="date" value={dateFrom} onInput={(e) => setDateFrom((e.target as HTMLInputElement).value)} />
        <input type="date" value={dateTo} onInput={(e) => setDateTo((e.target as HTMLInputElement).value)} />
        <button type="button" onClick={load}>Apply filters</button>
      </div>

      {entries.length === 0
        ? <p style="color: #666;">No audit log entries found</p>
        : (
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: #f5f5f5; text-align: left;">
                <th style="padding: 0.5rem;">Timestamp</th>
                <th>Moderator</th>
                <th>Action</th>
                <th>Target</th>
                <th>Old</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style="border-bottom: 1px solid #eee;">
                  <td style="padding: 0.5rem;">{new Date(e.timestamp).toISOString()}</td>
                  <td>{e.moderator_username ?? e.moderator_id}</td>
                  <td>{e.action_type}</td>
                  <td>{e.target_type}:{e.target_id}</td>
                  <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis;">
                    {e.old_value ?? "—"}
                  </td>
                  <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis;">
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
