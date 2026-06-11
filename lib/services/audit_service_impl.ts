import type { AuditService } from "../interfaces/audit_service.ts";
import type { Repository } from "../interfaces/repository.ts";
import type { AuditEntry, AuditEntryData, AuditFilter } from "../types.ts";

export class AuditServiceImpl implements AuditService {
  constructor(private repository: Repository) {}

  async logAction(action: AuditEntryData): Promise<void> {
    await this.repository.createAuditEntry(action);
  }

  async getLog(filters: AuditFilter): Promise<AuditEntry[]> {
    return await this.repository.getAuditLog(filters);
  }
}
