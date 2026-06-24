import { assertEquals, assertExists } from "@std/assert";
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
    message: "Original",
    submitter_name: "Tester",
  });
  await repo.close();
  await Deno.remove(dir, { recursive: true });
  return submission.id;
}

Deno.test({
  name: "testEditPendingSubmission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const id = await createPendingSubmission();

    const res = await handler(
      authedRequest(`http://localhost/api/semak/edit/${id}`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Updated message" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.message, "Updated message");
    assertEquals(body.status, "pending");

    await cleanupTestData();
  },
});

Deno.test({
  name: "testEditApprovedSubmission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const id = await createPendingSubmission();

    await handler(
      authedRequest(`http://localhost/api/semak/approve/${id}`, token, { method: "POST" }),
      serveInfo,
    );

    const res = await handler(
      authedRequest(`http://localhost/api/semak/edit/${id}`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Approved edit" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.message, "Approved edit");
    assertEquals(body.status, "approved");

    await cleanupTestData();
  },
});

Deno.test({
  name: "testEditAuditPreservesOldValues",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const id = await createPendingSubmission();

    await handler(
      authedRequest(`http://localhost/api/semak/edit/${id}`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Changed" }),
      }),
      serveInfo,
    );

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
    const logs = (await service.getAuditLog({ action_type: "edit" })).filter((e) =>
      e.target_id === id
    );
    assertEquals(logs.length, 1);
    assertExists(logs[0].old_value);
    assertEquals(logs[0].old_value!.includes("Original"), true);
    await repo.close();
    await Deno.remove(dir, { recursive: true });

    await cleanupTestData();
  },
});
