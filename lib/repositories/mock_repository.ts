import type { Repository, StoredSession } from "./interfaces/repository.ts";
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
import type { AuthUser } from "../services/auth_service.ts";

// Helper to convert Date to ISO string
function toIso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

// Helper to parse ISO string to Date
function toDate(iso: string | undefined): Date | undefined {
  return iso ? new Date(iso) : undefined;
}

// In-memory storage for mock repository
const submissions = new Map<string, Submission>();
const users = new Map<string, User>();
const moderators = new Map<string, Moderator>();
const displayWallUsers = new Map<string, DisplayWallUser>();
const systemConfigs = new Map<string, SystemConfig>();
const auditLog = new Map<string, AuditEntry>();
const sessions = new Map<string, StoredSession>();

let idCounter = 0;
function generateId(): string {
  return `mock_${++idCounter}_${crypto.randomUUID().slice(0, 8)}`;
}

export class MockRepository implements Repository {
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  // Submission operations
  async createSubmission(data: SubmissionData): Promise<Submission> {
    const id = generateId();
    const now = new Date();
    const submission: Submission = {
      id,
      image_url: data.image_url,
      message: data.message,
      submitter_name: data.submitter_name,
      social_handle: data.social_handle,
      status: "pending",
      source: data.source ?? "manual_upload",
      source_metadata: data.source_metadata,
      flagged_words: data.flagged_words,
      is_flagged: data.is_flagged ?? false,
      approved_by: undefined,
      approved_at: undefined,
      edited_by: undefined,
      edited_by_username: undefined,
      edited_at: undefined,
      edit_count: 0,
      created_at: now.toISOString(),
    };
    submissions.set(id, submission);
    return submission;
  }

  async getSubmissionById(id: string): Promise<Submission | null> {
    return submissions.get(id) ?? null;
  }

  async getSubmissionsByStatus(status: Submission["status"]): Promise<Submission[]> {
    return Array.from(submissions.values())
      .filter((s) => s.status === status)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async updateSubmissionStatusIfPending(
    id: string,
    status: "approved" | "rejected",
    approvedBy?: string,
  ): Promise<Submission | null> {
    const submission = submissions.get(id);
    if (!submission || submission.status !== "pending") {
      return null;
    }
    submission.status = status;
    submission.approved_by = approvedBy;
    submission.approved_at = status === "approved" ? new Date().toISOString() : undefined;
    return submission;
  }

  async updateSubmissionStatus(
    id: string,
    status: Submission["status"],
    approvedBy?: string,
  ): Promise<Submission> {
    const submission = submissions.get(id);
    if (!submission) {
      throw new Error(`Submission not found: ${id}`);
    }
    submission.status = status;
    submission.approved_by = approvedBy;
    submission.approved_at = status === "approved" ? new Date().toISOString() : undefined;
    return submission;
  }

  async updateSubmissionContent(
    id: string,
    data: SubmissionEditData,
    editedBy: string,
    flags?: SubmissionEditFlags,
  ): Promise<Submission> {
    const submission = submissions.get(id);
    if (!submission) {
      throw new Error(`Submission not found: ${id}`);
    }
    if (data.message !== undefined) submission.message = data.message;
    if (data.submitter_name !== undefined) submission.submitter_name = data.submitter_name;
    if (data.social_handle !== undefined) submission.social_handle = data.social_handle;
    if (flags?.is_flagged !== undefined) submission.is_flagged = flags.is_flagged;
    if (flags?.flagged_words !== undefined) submission.flagged_words = flags.flagged_words;
    submission.edited_by = editedBy;
    submission.edited_at = new Date().toISOString();
    submission.edit_count++;
    return submission;
  }

  async deleteSubmission(id: string): Promise<void> {
    submissions.delete(id);
  }

  // User operations
  async authenticateUser(username: string): Promise<User | null> {
    return Array.from(users.values()).find((u) => u.username === username) ?? null;
  }

  async getUserById(id: string): Promise<User | null> {
    return users.get(id) ?? null;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const id = generateId();
    const now = new Date();
    const user: User = {
      id,
      username: data.username,
      password_hash: data.password_hash,
      role: data.role,
      disabled: false,
      disabled_at: undefined,
      created_at: now.toISOString(),
      created_by: data.created_by,
    };
    users.set(id, user);
    return user;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<boolean> {
    const user = users.get(userId);
    if (!user) return false;
    user.password_hash = passwordHash;
    return true;
  }

  async listModerators(): Promise<Moderator[]> {
    return Array.from(moderators.values()).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async createModerator(data: CreateUserData): Promise<User> {
    return this.createUser({ ...data, role: "moderator" });
  }

  async resetModeratorPassword(id: string, passwordHash: string): Promise<boolean> {
    const mod = moderators.get(id);
    if (!mod) return false;
    // Find the user and update password
    for (const user of users.values()) {
      if (user.id === id && user.role === "moderator") {
        user.password_hash = passwordHash;
        return true;
      }
    }
    return false;
  }

  async disableModerator(id: string): Promise<boolean> {
    const mod = moderators.get(id);
    if (!mod) return false;
    mod.disabled = true;
    mod.disabled_at = new Date().toISOString();
    return true;
  }

  async enableModerator(id: string): Promise<boolean> {
    const mod = moderators.get(id);
    if (!mod) return false;
    mod.disabled = false;
    mod.disabled_at = undefined;
    return true;
  }

  async deleteModerator(id: string): Promise<boolean> {
    return moderators.delete(id) && users.delete(id);
  }

  // System config operations
  async getSystemConfig(key: string): Promise<SystemConfig | null> {
    return systemConfigs.get(key) ?? null;
  }

  async getAllSystemConfigs(): Promise<SystemConfig[]> {
    return Array.from(systemConfigs.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  async upsertSystemConfig(
    key: string,
    value: string,
    updatedBy: string,
  ): Promise<SystemConfig> {
    const existing = systemConfigs.get(key);
    const now = new Date();
    const config: SystemConfig = {
      key,
      value,
      default_value: existing?.default_value ?? value,
      updated_at: now.toISOString(),
      updated_by: updatedBy,
    };
    systemConfigs.set(key, config);
    return config;
  }

  async resetSystemConfigToDefault(key: string): Promise<SystemConfig> {
    const config = systemConfigs.get(key);
    if (!config) {
      throw new Error(`Config not found: ${key}`);
    }
    config.value = config.default_value;
    config.updated_at = new Date().toISOString();
    return config;
  }

  // Audit log operations
  async createAuditEntry(entry: AuditEntryData): Promise<AuditEntry> {
    const id = generateId();
    const audit: AuditEntry = {
      id,
      moderator_id: entry.moderator_id,
      moderator_username: undefined,
      action_type: entry.action_type,
      target_type: entry.target_type,
      target_id: entry.target_id,
      old_value: entry.old_value ?? undefined,
      new_value: entry.new_value ?? undefined,
      timestamp: new Date().toISOString(),
    };
    auditLog.set(id, audit);
    return audit;
  }

  async getAuditLog(filters: AuditFilter): Promise<AuditEntry[]> {
    let results = Array.from(auditLog.values());

    if (filters.moderator_id) {
      results = results.filter((a) => a.moderator_id === filters.moderator_id);
    }
    if (filters.action_type) {
      results = results.filter((a) => a.action_type === filters.action_type);
    }
    if (filters.date_from) {
      results = results.filter((a) => new Date(a.timestamp) >= new Date(filters.date_from!));
    }
    if (filters.date_to) {
      results = results.filter((a) => new Date(a.timestamp) <= new Date(filters.date_to!));
    }

    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters.limit !== undefined) {
      results = results.slice(0, filters.limit);
    }
    if (filters.offset !== undefined) {
      results = results.slice(filters.offset);
    }

    return results;
  }

  async countAuditLog(filters: AuditFilter): Promise<number> {
    const logs = await this.getAuditLog(filters);
    return logs.length;
  }

  // Display Wall operations
  async createDisplayWallUser(data: CreateUserData): Promise<User> {
    return this.createUser({ ...data, role: "display_wall" });
  }

  async listDisplayWallUsers(): Promise<DisplayWallUser[]> {
    return Array.from(displayWallUsers.values()).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async disableDisplayWallUser(id: string): Promise<boolean> {
    const user = displayWallUsers.get(id);
    if (!user) return false;
    user.disabled = true;
    user.disabled_at = new Date().toISOString();
    return true;
  }

  async enableDisplayWallUser(id: string): Promise<boolean> {
    const user = displayWallUsers.get(id);
    if (!user) return false;
    user.disabled = false;
    user.disabled_at = undefined;
    return true;
  }

  async deleteDisplayWallUser(id: string): Promise<boolean> {
    return displayWallUsers.delete(id) && users.delete(id);
  }

  async getDisplayOverrideState(): Promise<DisplayOverrideState | null> {
    const config = systemConfigs.get("display_override_state");
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

  // Session persistence
  async loadActiveSessions(): Promise<StoredSession[]> {
    const now = new Date();
    return Array.from(sessions.values()).filter((s) => s.expiresAt >= now);
  }

  async upsertSession(
    token: string,
    userId: string,
    userSnapshot: AuthUser,
    expiresAt: Date,
  ): Promise<void> {
    sessions.set(token, {
      token,
      user: userSnapshot,
      expiresAt,
    });
  }

  async deleteSession(token: string): Promise<void> {
    sessions.delete(token);
  }

  async deleteSessionsByUserId(userId: string, exceptToken?: string): Promise<void> {
    for (const [token, session] of sessions.entries()) {
      if (session.user.id === userId && token !== exceptToken) {
        sessions.delete(token);
      }
    }
  }

  async purgeExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [token, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(token);
      }
    }
  }

  // Helper methods for testing
  clear(): void {
    submissions.clear();
    users.clear();
    moderators.clear();
    displayWallUsers.clear();
    systemConfigs.clear();
    auditLog.clear();
    sessions.clear();
    idCounter = 0;
  }
}

// Singleton instance for global cleanup
let mockInstance: MockRepository | null = null;

export function getMockRepository(): MockRepository | null {
  return mockInstance;
}

export function setMockRepository(repo: MockRepository): void {
  mockInstance = repo;
}

export function clearMockRepository(): void {
  if (mockInstance) {
    mockInstance.clear();
  }
}
