import { Client } from "@db/postgres";
import { createPostgresClient } from "../db_url.ts";
import type { Repository } from "../interfaces/repository.ts";
import type {
  AuditEntry,
  AuditEntryData,
  AuditFilter,
  CreateUserData,
  DisplayOverrideState,
  DisplayWallUser,
  Moderator,
  Submission,
  SubmissionData,
  SubmissionEditData,
  SubmissionEditFlags,
  SystemConfig,
  User,
} from "../types.ts";

type SubmissionRow = {
  id: string;
  image_url: string;
  message: string;
  submitter_name: string;
  social_handle: string | null;
  status: Submission["status"];
  source: string;
  source_metadata: Record<string, unknown> | null;
  flagged_words: string[] | null;
  is_flagged: boolean;
  approved_by: string | null;
  approved_at: Date | null;
  edited_by: string | null;
  edited_at: Date | null;
  edit_count: number;
  created_at: Date;
};

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: User["role"];
  disabled: boolean;
  disabled_at: Date | null;
  created_at: Date;
  created_by: string | null;
};

type AuditRow = {
  id: string;
  moderator_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value: string | null;
  new_value: string | null;
  timestamp: Date;
};

type ConfigRow = {
  key: string;
  value: string;
  default_value: string;
  updated_at: Date;
  updated_by: string | null;
};

function toIso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

function mapSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    image_url: row.image_url,
    message: row.message,
    submitter_name: row.submitter_name,
    social_handle: row.social_handle ?? undefined,
    status: row.status,
    source: row.source,
    source_metadata: row.source_metadata ?? undefined,
    flagged_words: row.flagged_words ?? undefined,
    is_flagged: row.is_flagged,
    approved_by: row.approved_by ?? undefined,
    approved_at: toIso(row.approved_at),
    edited_by: row.edited_by ?? undefined,
    edited_at: toIso(row.edited_at),
    edit_count: row.edit_count,
    created_at: row.created_at.toISOString(),
  };
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    role: row.role,
    disabled: row.disabled,
    disabled_at: toIso(row.disabled_at),
    created_at: row.created_at.toISOString(),
    created_by: row.created_by ?? undefined,
  };
}

function mapModerator(row: UserRow): Moderator {
  return {
    id: row.id,
    username: row.username,
    disabled: row.disabled,
    disabled_at: toIso(row.disabled_at),
    created_at: row.created_at.toISOString(),
    created_by: row.created_by ?? undefined,
  };
}

function mapDisplayWallUser(row: UserRow): DisplayWallUser {
  return {
    id: row.id,
    username: row.username,
    disabled: row.disabled,
    disabled_at: toIso(row.disabled_at),
    created_at: row.created_at.toISOString(),
    created_by: row.created_by ?? undefined,
  };
}

function mapAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    moderator_id: row.moderator_id,
    action_type: row.action_type,
    target_type: row.target_type,
    target_id: row.target_id,
    old_value: row.old_value ?? undefined,
    new_value: row.new_value ?? undefined,
    timestamp: row.timestamp.toISOString(),
  };
}

function mapConfig(row: ConfigRow): SystemConfig {
  return {
    key: row.key,
    value: row.value,
    default_value: row.default_value,
    updated_at: row.updated_at.toISOString(),
    updated_by: row.updated_by ?? undefined,
  };
}

export class PostgresRepository implements Repository {
  private client: Client;
  private connected = false;

  constructor(databaseUrl: string) {
    this.client = createPostgresClient(databaseUrl);
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }

  private async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.connect();
    const result = await this.client.queryObject<T>(sql, params);
    return result.rows;
  }

  async createSubmission(data: SubmissionData): Promise<Submission> {
    const rows = await this.query<SubmissionRow>(
      `INSERT INTO submissions (
        image_url, message, submitter_name, social_handle, source,
        source_metadata, flagged_words, is_flagged
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.image_url,
        data.message,
        data.submitter_name,
        data.social_handle ?? null,
        data.source ?? "manual_upload",
        data.source_metadata ? JSON.stringify(data.source_metadata) : null,
        data.flagged_words ?? null,
        data.is_flagged ?? false,
      ],
    );
    return mapSubmission(rows[0]);
  }

  async getSubmissionById(id: string): Promise<Submission | null> {
    const rows = await this.query<SubmissionRow>(
      `SELECT * FROM submissions WHERE id = $1`,
      [id],
    );
    return rows.length > 0 ? mapSubmission(rows[0]) : null;
  }

  async getSubmissionsByStatus(status: Submission["status"]): Promise<Submission[]> {
    const rows = await this.query<SubmissionRow>(
      `SELECT * FROM submissions WHERE status = $1 ORDER BY created_at ASC`,
      [status],
    );
    return rows.map(mapSubmission);
  }

  async updateSubmissionStatusIfPending(
    id: string,
    status: "approved" | "rejected",
    approvedBy?: string,
  ): Promise<Submission | null> {
    const rows = await this.query<SubmissionRow>(
      `UPDATE submissions SET
        status = $2,
        approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
        approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
      [id, status, approvedBy ?? null],
    );
    return rows.length > 0 ? mapSubmission(rows[0]) : null;
  }

  async updateSubmissionStatus(
    id: string,
    status: Submission["status"],
    approvedBy?: string,
  ): Promise<Submission> {
    const rows = await this.query<SubmissionRow>(
      `UPDATE submissions SET
        status = $2,
        approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
        approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE approved_at END
      WHERE id = $1
      RETURNING *`,
      [id, status, approvedBy ?? null],
    );
    if (rows.length === 0) throw new Error(`Submission not found: ${id}`);
    return mapSubmission(rows[0]);
  }

  async updateSubmissionContent(
    id: string,
    data: SubmissionEditData,
    editedBy: string,
    flags?: SubmissionEditFlags,
  ): Promise<Submission> {
    const rows = await this.query<SubmissionRow>(
      `UPDATE submissions SET
        message = COALESCE($2, message),
        submitter_name = COALESCE($3, submitter_name),
        social_handle = COALESCE($4, social_handle),
        is_flagged = COALESCE($6, is_flagged),
        flagged_words = COALESCE($7, flagged_words),
        edited_by = $5,
        edited_at = NOW(),
        edit_count = edit_count + 1
      WHERE id = $1
      RETURNING *`,
      [
        id,
        data.message ?? null,
        data.submitter_name ?? null,
        data.social_handle ?? null,
        editedBy,
        flags?.is_flagged ?? null,
        flags?.flagged_words ?? null,
      ],
    );
    if (rows.length === 0) throw new Error(`Submission not found: ${id}`);
    return mapSubmission(rows[0]);
  }

  async deleteSubmission(id: string): Promise<void> {
    await this.query(`DELETE FROM submissions WHERE id = $1`, [id]);
  }

  async authenticateUser(username: string): Promise<User | null> {
    const rows = await this.query<UserRow>(
      `SELECT * FROM users WHERE username = $1`,
      [username],
    );
    return rows.length > 0 ? mapUser(rows[0]) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const rows = await this.query<UserRow>(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    return rows.length > 0 ? mapUser(rows[0]) : null;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const rows = await this.query<UserRow>(
      `INSERT INTO users (username, password_hash, role, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.username, data.password_hash, data.role, data.created_by ?? null],
    );
    return mapUser(rows[0]);
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id`,
      [userId, passwordHash],
    );
    return rows.length > 0;
  }

  async listModerators(): Promise<Moderator[]> {
    const rows = await this.query<UserRow>(
      `SELECT * FROM users WHERE role = 'moderator' ORDER BY created_at ASC`,
    );
    return rows.map(mapModerator);
  }

  async createModerator(data: CreateUserData): Promise<User> {
    return await this.createUser({ ...data, role: "moderator" });
  }

  async resetModeratorPassword(id: string, passwordHash: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `UPDATE users SET password_hash = $2 WHERE id = $1 AND role = 'moderator' RETURNING id`,
      [id, passwordHash],
    );
    return rows.length > 0;
  }

  async disableModerator(id: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `UPDATE users SET disabled = true, disabled_at = NOW()
       WHERE id = $1 AND role = 'moderator' RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async enableModerator(id: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `UPDATE users SET disabled = false, disabled_at = NULL
       WHERE id = $1 AND role = 'moderator' RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async deleteModerator(id: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `DELETE FROM users WHERE id = $1 AND role = 'moderator' RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async getSystemConfig(key: string): Promise<SystemConfig | null> {
    const rows = await this.query<ConfigRow>(
      `SELECT * FROM system_config WHERE key = $1`,
      [key],
    );
    return rows.length > 0 ? mapConfig(rows[0]) : null;
  }

  async getAllSystemConfigs(): Promise<SystemConfig[]> {
    const rows = await this.query<ConfigRow>(`SELECT * FROM system_config ORDER BY key ASC`);
    return rows.map(mapConfig);
  }

  async upsertSystemConfig(
    key: string,
    value: string,
    updatedBy: string,
  ): Promise<SystemConfig> {
    const rows = await this.query<ConfigRow>(
      `INSERT INTO system_config (key, value, default_value, updated_by)
       VALUES ($1, $2, $2, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [key, value, updatedBy],
    );
    return mapConfig(rows[0]);
  }

  async resetSystemConfigToDefault(key: string): Promise<SystemConfig> {
    const rows = await this.query<ConfigRow>(
      `UPDATE system_config SET value = default_value, updated_at = NOW()
       WHERE key = $1 RETURNING *`,
      [key],
    );
    if (rows.length === 0) throw new Error(`Config not found: ${key}`);
    return mapConfig(rows[0]);
  }

  async createAuditEntry(entry: AuditEntryData): Promise<AuditEntry> {
    const rows = await this.query<AuditRow>(
      `INSERT INTO audit_log (moderator_id, action_type, target_type, target_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        entry.moderator_id,
        entry.action_type,
        entry.target_type,
        entry.target_id,
        entry.old_value ?? null,
        entry.new_value ?? null,
      ],
    );
    return mapAudit(rows[0]);
  }

  async getAuditLog(filters: AuditFilter): Promise<AuditEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.moderator_id) {
      params.push(filters.moderator_id);
      conditions.push(`moderator_id = $${params.length}`);
    }
    if (filters.action_type) {
      params.push(filters.action_type);
      conditions.push(`action_type = $${params.length}`);
    }
    if (filters.target_type) {
      params.push(filters.target_type);
      conditions.push(`target_type = $${params.length}`);
    }
    if (filters.date_from) {
      params.push(filters.date_from);
      conditions.push(`timestamp >= $${params.length}`);
    }
    if (filters.date_to) {
      params.push(filters.date_to);
      conditions.push(`timestamp <= $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await this.query<AuditRow>(
      `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC`,
      params,
    );
    return rows.map(mapAudit);
  }

  async createDisplayWallUser(data: CreateUserData): Promise<User> {
    return await this.createUser({ ...data, role: "display_wall" });
  }

  async listDisplayWallUsers(): Promise<DisplayWallUser[]> {
    const rows = await this.query<UserRow>(
      `SELECT * FROM users WHERE role = 'display_wall' ORDER BY created_at ASC`,
    );
    return rows.map(mapDisplayWallUser);
  }

  async disableDisplayWallUser(id: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `UPDATE users SET disabled = true, disabled_at = NOW()
       WHERE id = $1 AND role = 'display_wall' RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async enableDisplayWallUser(id: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `UPDATE users SET disabled = false, disabled_at = NULL
       WHERE id = $1 AND role = 'display_wall' RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async deleteDisplayWallUser(id: string): Promise<boolean> {
    const rows = await this.query<{ id: string }>(
      `DELETE FROM users WHERE id = $1 AND role = 'display_wall' RETURNING id`,
      [id],
    );
    return rows.length > 0;
  }

  async getDisplayOverrideState(): Promise<DisplayOverrideState | null> {
    const config = await this.getSystemConfig("display_override_state");
    if (!config) return null;
    try {
      return JSON.parse(config.value) as DisplayOverrideState;
    } catch {
      return null;
    }
  }

  async setDisplayOverrideState(state: DisplayOverrideState): Promise<void> {
    await this.upsertSystemConfig(
      "display_override_state",
      JSON.stringify(state),
      state.commanded_by,
    );
  }
}
