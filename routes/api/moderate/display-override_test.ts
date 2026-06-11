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

Deno.test({
  name: "testBlankDisplay",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const form = new FormData();
    form.append("type", "blank");
    const res = await handler(
      authedRequest("http://localhost/api/moderate/display-override", token, {
        method: "POST",
        body: form,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const repo = await createTestRepository();
    const storage = new FileStorageService(await Deno.makeTempDir());
    const service = new PhotoWallService(
      repo,
      storage,
      new MemoryRealtimeService(),
      new AuditServiceImpl(repo),
      new AutoModeratorServiceImpl(),
    );
    const logs = await service.getAuditLog({ action_type: "blank_display" });
    assertEquals(logs.length, 1);
    await repo.close();

    await cleanupTestData();
  },
});

Deno.test({
  name: "testResumeDisplay",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const form = new FormData();
    form.append("type", "resume");
    const res = await handler(
      authedRequest("http://localhost/api/moderate/display-override", token, {
        method: "POST",
        body: form,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const repo = await createTestRepository();
    const state = await repo.getDisplayOverrideState();
    assertEquals(state?.type, "normal");
    await repo.close();

    await cleanupTestData();
  },
});
