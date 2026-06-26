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
} from "../../../lib/api/semak_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../lib/test_helpers.ts";
import { testJpegBlob } from "../../../lib/image/test_jpeg.ts";

Deno.test({
  name: "testDeleteApprovedSubmission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

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
      message: "Delete me",
      submitter_name: "Tester",
    });
    await service.approveSubmission(submission.id, "mod-test");
    const imagePath = submission.image_url.replace(/^\//, "");
    await repo.close();

    const res = await handler(
      authedRequest(`http://localhost/api/semak/delete/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const checkRepo = await createTestRepository();
    const approved = await checkRepo.getSubmissionsByStatus("approved");
    assertEquals(approved.some((s) => s.id === submission.id), false);
    const logs = await checkRepo.getAuditLog({ action_type: "delete" });
    assertEquals(logs.some((e) => e.target_id === submission.id), true);
    await checkRepo.close();

    await Deno.remove(dir, { recursive: true });
    void imagePath;
    await cleanupTestData();
  },
});
