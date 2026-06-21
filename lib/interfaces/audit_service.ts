import type { AuditEntry, AuditEntryData, AuditFilter } from "../types.ts";

export interface AuditService {
  logAction(action: AuditEntryData): Promise<void>;
  getLog(filters: AuditFilter): Promise<AuditEntry[]>;
}
