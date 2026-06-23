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
import { testJpegBlob } from "../../../lib/image/test_jpeg.ts";

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
    image: testJpegBlob(),
    message: "Reject me",
    submitter_name: "Tester",
  });
  await repo.close();
  await Deno.remove(dir, { recursive: true });
  return submission.id;
}

Deno.test({
  name: "testRejectSubmission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const id = await createPendingSubmission();

    const res = await handler(
      authedRequest(`http://localhost/api/moderate/reject/${id}`, token, { method: "POST" }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.status, "rejected");

    await cleanupTestData();
  },
});
