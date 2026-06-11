import type { AppConfig } from "./config.ts";
import type { AuditService } from "./interfaces/audit_service.ts";
import type { AutoModeratorService } from "./interfaces/auto_moderator_service.ts";
import type { RealtimeService } from "./interfaces/realtime_service.ts";
import type { Repository } from "./interfaces/repository.ts";
import type { StorageService } from "./interfaces/storage_service.ts";
import { PostgresRepository } from "./repositories/postgres_repository.ts";
import { FileStorageService } from "./repositories/file_storage_service.ts";
import { MemoryRealtimeService } from "./repositories/memory_realtime_service.ts";
import { AuditServiceImpl } from "./services/audit_service_impl.ts";
import { AutoModeratorServiceImpl } from "./services/auto_moderator_service_impl.ts";
import { PhotoWallService } from "./services/photo_wall_service.ts";

export interface PhotoWallServiceDeps {
  repository: Repository;
  storage: StorageService;
  realtime: RealtimeService;
  audit: AuditService;
  autoModerator: AutoModeratorService;
}

export function createServices(config: AppConfig): PhotoWallServiceDeps {
  const repository = new PostgresRepository(config.database.url);
  const storage = new FileStorageService(config.storage.path);
  const realtime = new MemoryRealtimeService();
  const audit = new AuditServiceImpl(repository);
  const autoModerator = new AutoModeratorServiceImpl();

  return { repository, storage, realtime, audit, autoModerator };
}

export function createPhotoWallService(config: AppConfig): PhotoWallService {
  const deps = createServices(config);
  return new PhotoWallService(
    deps.repository,
    deps.storage,
    deps.realtime,
    deps.audit,
    deps.autoModerator,
  );
}
