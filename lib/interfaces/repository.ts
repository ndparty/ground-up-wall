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

export interface Repository {
  // Submission operations
  createSubmission(data: SubmissionData): Promise<Submission>;
  getSubmissionById(id: string): Promise<Submission | null>;
  getSubmissionsByStatus(status: Submission["status"]): Promise<Submission[]>;
  updateSubmissionStatus(
    id: string,
    status: Submission["status"],
    approvedBy?: string,
  ): Promise<Submission>;
  updateSubmissionStatusIfPending(
    id: string,
    status: "approved" | "rejected",
    approvedBy?: string,
  ): Promise<Submission | null>;
  updateSubmissionContent(
    id: string,
    data: SubmissionEditData,
    editedBy: string,
    flags?: SubmissionEditFlags,
  ): Promise<Submission>;
  deleteSubmission(id: string): Promise<void>;

  // User operations
  authenticateUser(username: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(data: CreateUserData): Promise<User>;
  updateUserPassword(userId: string, passwordHash: string): Promise<boolean>;
  listModerators(): Promise<Moderator[]>;
  createModerator(data: CreateUserData): Promise<User>;
  resetModeratorPassword(id: string, passwordHash: string): Promise<boolean>;
  disableModerator(id: string): Promise<boolean>;
  enableModerator(id: string): Promise<boolean>;
  deleteModerator(id: string): Promise<boolean>;

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
  disableDisplayWallUser(id: string): Promise<boolean>;
  enableDisplayWallUser(id: string): Promise<boolean>;
  deleteDisplayWallUser(id: string): Promise<boolean>;
  getDisplayOverrideState(): Promise<DisplayOverrideState | null>;
  setDisplayOverrideState(state: DisplayOverrideState): Promise<void>;

  // Connection lifecycle
  connect(): Promise<void>;
  close(): Promise<void>;
}
