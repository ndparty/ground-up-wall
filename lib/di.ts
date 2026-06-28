import type { AppConfig } from "./config.ts";
import type { AuditService } from "./interfaces/audit_service.ts";
import type { AutoModeratorService } from "./interfaces/auto_moderator_service.ts";
import type { RealtimeService } from "./interfaces/realtime_service.ts";
import type { Repository } from "./interfaces/repository.ts";
import type { StorageService } from "./interfaces/storage_service.ts";
import { PostgresRepository } from "./repositories/postgres_repository.ts";
import { MockRepository } from "./repositories/mock_repository.ts";
import { FileStorageService } from "./repositories/file_storage_service.ts";
import { MemoryRealtimeService } from "./repositories/memory_realtime_service.ts";
import { AuditServiceImpl } from "./services/audit_service_impl.ts";
import { AutoModeratorServiceImpl } from "./services/auto_moderator_service_impl.ts";
import { AuthService } from "./services/auth_service.ts";
import { createSessionStore, isPostgresSessionStore } from "./services/session_store.ts";
import { PhotoWallService } from "./services/photo_wall_service.ts";

export interface AppState {
  auth: AuthService;
  photoWall: PhotoWallService;
  repository: Repository;
}

export interface PhotoWallServiceDeps {
  repository: Repository;
  storage: StorageService;
  realtime: RealtimeService;
  audit: AuditService;
  autoModerator: AutoModeratorService;
}

export async function createServices(config: AppConfig): Promise<PhotoWallServiceDeps> {
  const useMock = Deno.env.get("USE_MOCK_DB") === "true";
  let repository: Repository;

  if (useMock) {
    // Use singleton instance for mock DB so tests and app share the same data
    const mockModule = await import("./repositories/mock_repository.ts");
    let mockRepo = mockModule.getMockRepository();
    if (!mockRepo) {
      mockRepo = new mockModule.MockRepository();
      mockModule.setMockRepository(mockRepo);
    }
    repository = mockRepo;
  } else {
    repository = new PostgresRepository(config.database.url);
  }

  const storage = new FileStorageService(config.storage.path);
  const realtime = new MemoryRealtimeService();
  const audit = new AuditServiceImpl(repository);
  const autoModerator = new AutoModeratorServiceImpl();

  return { repository, storage, realtime, audit, autoModerator };
}

export async function createPhotoWallService(config: AppConfig): Promise<PhotoWallService> {
  const deps = await createServices(config);
  return new PhotoWallService(
    deps.repository,
    deps.storage,
    deps.realtime,
    deps.audit,
    deps.autoModerator,
  );
}

export async function createAppState(config: AppConfig): Promise<AppState> {
  const deps = await createServices(config);

  try {
    await deps.repository.connect();
  } catch (error) {
    const useMock = Deno.env.get("USE_MOCK_DB") === "true";
    if (!useMock) {
      console.error(
        `Postgres not reachable at ${config.database.url} — is the service running?`,
      );
      throw error;
    }
    // If using mock DB, connection should always succeed
    // If it fails here, something is wrong with the mock implementation
    console.error("Mock database connection failed:", error);
    throw error;
  }

  const sessions = createSessionStore(deps.repository);
  if (isPostgresSessionStore(sessions)) {
    await sessions.ready();
  } else {
    sessions.load();
  }

  const photoWall = new PhotoWallService(
    deps.repository,
    deps.storage,
    deps.realtime,
    deps.audit,
    deps.autoModerator,
  );
  const auth = new AuthService(deps.repository, deps.audit, sessions);
  return { auth, photoWall, repository: deps.repository };
}

export async function closeAppState(state: AppState): Promise<void> {
  await state.repository.close();
}
