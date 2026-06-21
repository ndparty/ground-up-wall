import { assertEquals } from "@std/assert";
import { FileStorageService } from "../../../lib/repositories/file_storage_service.ts";
import { MemoryRealtimeService } from "../../../lib/repositories/memory_realtime_service.ts";
import { AuditServiceImpl } from "../../../lib/services/audit_service_impl.ts";
import { AutoModeratorServiceImpl } from "../../../lib/services/auto_moderator_service_impl.ts";
import { PhotoWallService } from "../../../lib/services/photo_wall_service.ts";
import {
  authedRequest,
  createTestHandler,
  loginAsModerator,
  serveInfo,
} from "../../../lib/api/moderate_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../lib/test_helpers.ts";

async function createPendingSubmission(): Promise<string> {
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
    message: "Test message",
    submitter_name: "Tester",
  });
  await repo.close();
  await Deno.remove(dir, { recursive: true });
  return submission.id;
}

Deno.test({
  name: "testApproveSubmission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const id = await createPendingSubmission();

    const res = await handler(
      authedRequest(`http://localhost/api/moderate/approve/${id}`, token, { method: "POST" }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.status, "approved");

    await cleanupTestData();
  },
});

Deno.test({
  name: "testApproveAlreadyApproved",
  async fn() {
    const handler = await createTestHandler();
    const { token, userId } = await loginAsModerator(handler);
    const id = await createPendingSubmission();

    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${id}`, token, { method: "POST" }),
      serveInfo,
    );
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/approve/${id}`, token, { method: "POST" }),
      serveInfo,
    );
    assertEquals(res.status, 400);

    await cleanupTestData();
    void userId;
  },
});
