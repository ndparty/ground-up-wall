import * as bcrypt from "bcrypt";
import {
  authedRequest,
  createTestHandler,
  loginAsModerator,
  serveInfo,
  type TestHandler,
} from "../lib/api/moderate_route_test_helpers.ts";
import {
  loginAsAdmin,
  loginAsDisplayWall,
} from "../lib/api/display_route_test_helpers.ts";
import { FileStorageService } from "../lib/repositories/file_storage_service.ts";
import { MemoryRealtimeService } from "../lib/repositories/memory_realtime_service.ts";
import { AuditServiceImpl } from "../lib/services/audit_service_impl.ts";
import { AutoModeratorServiceImpl } from "../lib/services/auto_moderator_service_impl.ts";
import { PhotoWallService } from "../lib/services/photo_wall_service.ts";
import type { Submission, SubmissionInput } from "../lib/types.ts";
import type { PostgresRepository } from "../lib/repositories/postgres_repository.ts";
import { cleanupTestData, createTestRepository } from "../lib/test_helpers.ts";

export {
  authedRequest,
  cleanupTestData,
  createTestHandler,
  createTestRepository,
  loginAsAdmin,
  loginAsDisplayWall,
  loginAsModerator,
  serveInfo,
};
export type { TestHandler };

export async function setupTestDb(): Promise<PostgresRepository> {
  await cleanupTestData();
  return await createTestRepository();
}

export async function teardownTestDb(): Promise<void> {
  await cleanupTestData();
}

export interface AuthPair {
  username: string;
  password: string;
  userId: string;
  token: string;
}

export async function setupModeratorAndDisplayWall(
  handler: TestHandler,
): Promise<{ moderator: AuthPair; displayWall: AuthPair }> {
  await cleanupTestData();
  const repo = await createTestRepository();
  const modPassword = "modpass";
  const dwPassword = "dwpass";
  const modHash = await bcrypt.hash(modPassword);
  const dwHash = await bcrypt.hash(dwPassword);
  const mod = await repo.createModerator({
    username: `mod_${crypto.randomUUID().slice(0, 8)}`,
    password_hash: modHash,
    role: "moderator",
  });
  const dw = await repo.createDisplayWallUser({
    username: `dw_${crypto.randomUUID().slice(0, 8)}`,
    password_hash: dwHash,
    role: "display_wall",
  });
  await repo.close();

  const modToken = await loginAs(handler, mod.username, modPassword);
  const dwToken = await loginAs(handler, dw.username, dwPassword);
  return {
    moderator: { username: mod.username, password: modPassword, userId: mod.id, token: modToken },
    displayWall: { username: dw.username, password: dwPassword, userId: dw.id, token: dwToken },
  };
}

export async function loginAs(
  handler: TestHandler,
  username: string,
  password: string,
): Promise<string> {
  const loginRes = await handler(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
    serveInfo,
  );
  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) throw new Error("Login did not return session cookie");
  const tokenMatch = cookie.match(/session=([^;]+)/);
  if (!tokenMatch) throw new Error("Session token missing from cookie");
  return decodeURIComponent(tokenMatch[1]);
}

export async function createTestAdmin(
  password = "adminpass",
): Promise<{ username: string; password: string; userId: string }> {
  const repo = await createTestRepository();
  const username = `admin_${crypto.randomUUID().slice(0, 8)}`;
  const hash = await bcrypt.hash(password);
  const user = await repo.createUser({
    username,
    password_hash: hash,
    role: "admin",
  });
  await repo.close();
  return { username, password, userId: user.id };
}

export async function createTestModeratorAccount(
  password = "modpass",
): Promise<{ username: string; password: string; userId: string }> {
  const repo = await createTestRepository();
  const username = `mod_${crypto.randomUUID().slice(0, 8)}`;
  const hash = await bcrypt.hash(password);
  const user = await repo.createModerator({
    username,
    password_hash: hash,
    role: "moderator",
  });
  await repo.close();
  return { username, password, userId: user.id };
}

export async function createTestDisplayWallUserAccount(
  password = "dwpass",
): Promise<{ username: string; password: string; userId: string }> {
  const repo = await createTestRepository();
  const username = `dw_${crypto.randomUUID().slice(0, 8)}`;
  const hash = await bcrypt.hash(password);
  const user = await repo.createDisplayWallUser({
    username,
    password_hash: hash,
    role: "display_wall",
  });
  await repo.close();
  return { username, password, userId: user.id };
}

export async function createTestSubmission(
  overrides: Partial<SubmissionInput> = {},
): Promise<Submission> {
  const dir = await Deno.makeTempDir();
  const repo = await createTestRepository();
  const storage = new FileStorageService(dir);
  const service = new PhotoWallService(
    repo,
    storage,
    new MemoryRealtimeService(),
    new AuditServiceImpl(repo),
    new AutoModeratorServiceImpl(),
  );
  const submission = await service.submitPublicSubmission({
    image: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    message: "Happy National Day",
    submitter_name: "Participant",
    ...overrides,
  });
  await repo.close();
  await Deno.remove(dir, { recursive: true });
  return submission;
}

export function makePhotoForm(entries: Record<string, string | Blob | File>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.append(key, value);
  }
  return form;
}

export function testPhoto(): File {
  return new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
}

export async function submitViaApi(
  handler: TestHandler,
  form: FormData,
): Promise<Response> {
  return await handler(
    new Request("http://localhost/api/submissions", { method: "POST", body: form }),
    serveInfo,
  );
}
