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
  SystemConfig,
  User,
} from "../types.ts";

export interface Repository {
  // Submission operations
  createSubmission(data: SubmissionData): Promise<Submission>;
  getSubmissionsByStatus(status: Submission["status"]): Promise<Submission[]>;
  updateSubmissionStatus(
    id: string,
    status: Submission["status"],
    approvedBy?: string,
  ): Promise<Submission>;
  updateSubmissionContent(
    id: string,
    data: SubmissionEditData,
    editedBy: string,
  ): Promise<Submission>;
  deleteSubmission(id: string): Promise<void>;

  // User operations
  authenticateUser(username: string): Promise<User | null>;
  createUser(data: CreateUserData): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  listModerators(): Promise<Moderator[]>;
  createModerator(data: CreateUserData): Promise<User>;
  resetModeratorPassword(id: string, passwordHash: string): Promise<void>;
  disableModerator(id: string): Promise<void>;
  enableModerator(id: string): Promise<void>;
  deleteModerator(id: string): Promise<void>;

  // System config operations
  getSystemConfig(key: string): Promise<SystemConfig | null>;
  getAllSystemConfigs(): Promise<SystemConfig[]>;
  upsertSystemConfig(key: string, value: string, updatedBy: string): Promise<SystemConfig>;
  resetSystemConfigToDefault(key: string): Promise<SystemConfig>;

  // Audit log operations
  createAuditEntry(entry: AuditEntryData): Promise<AuditEntry>;
  getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>;

  // Display Wall operations
  createDisplayWallUser(data: CreateUserData): Promise<User>;
  listDisplayWallUsers(): Promise<DisplayWallUser[]>;
  disableDisplayWallUser(id: string): Promise<void>;
  deleteDisplayWallUser(id: string): Promise<void>;
  getDisplayOverrideState(): Promise<DisplayOverrideState | null>;
  setDisplayOverrideState(state: DisplayOverrideState): Promise<void>;

  // Connection lifecycle
  connect(): Promise<void>;
  close(): Promise<void>;
}
