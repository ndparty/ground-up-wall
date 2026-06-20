export interface Submission {
  id: string;
  image_url: string;
  message: string;
  submitter_name: string;
  social_handle?: string;
  status: "pending" | "approved" | "rejected";
  source: string;
  source_metadata?: Record<string, unknown>;
  flagged_words?: string[];
  is_flagged: boolean;
  approved_by?: string;
  approved_at?: string;
  edited_by?: string;
  edited_by_username?: string;
  edited_at?: string;
  edit_count: number;
  created_at: string;
}

export interface SubmissionData {
  image_url: string;
  message: string;
  submitter_name: string;
  social_handle?: string;
  source?: string;
  source_metadata?: Record<string, unknown>;
  flagged_words?: string[];
  is_flagged?: boolean;
}

export interface SubmissionInput {
  image: Blob;
  message: string;
  submitter_name: string;
  social_handle?: string;
}

export interface SubmissionEditData {
  message?: string;
  submitter_name?: string;
  social_handle?: string;
}

export interface SubmissionEditFlags {
  is_flagged: boolean;
  flagged_words: string[];
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "moderator" | "display_wall";
  disabled: boolean;
  disabled_at?: string;
  created_at: string;
  created_by?: string;
}

export interface CreateUserData {
  username: string;
  password_hash: string;
  role: "admin" | "moderator" | "display_wall";
  created_by?: string;
}

export interface Moderator {
  id: string;
  username: string;
  disabled: boolean;
  disabled_at?: string;
  created_at: string;
  created_by?: string;
}

export interface DisplayWallUser {
  id: string;
  username: string;
  disabled: boolean;
  disabled_at?: string;
  created_at: string;
  created_by?: string;
}

export interface AuditEntry {
  id: string;
  moderator_id: string;
  moderator_username?: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
}

export interface AuditEntryData {
  moderator_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value?: string;
  new_value?: string;
}

export interface AuditFilter {
  moderator_id?: string;
  action_type?: string;
  target_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface SystemConfig {
  key: string;
  value: string;
  default_value: string;
  updated_at: string;
  updated_by?: string;
}

export interface DisplayOverrideState {
  type: "normal" | "blank" | "placeholder";
  imageUrl?: string;
  commanded_by: string;
  commanded_at: string;
}
