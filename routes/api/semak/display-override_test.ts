import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
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
import { loginAs } from "../../../tests/helpers.ts";

Deno.test({
  name: "testBlankDisplay",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const form = new FormData();
    form.append("type", "blank");
    const res = await handler(
      authedRequest("http://localhost/api/semak/display-override", token, {
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
      authedRequest("http://localhost/api/semak/display-override", token, {
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

Deno.test({
  name: "testModeratorPlaceholderUsesAdminDefault",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();

    const password = "pass123";
    const repo = await createTestRepository();
    const hash = await bcrypt.hash(password);
    const admin = await repo.createUser({
      username: `admin_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "admin",
    });
    const moderator = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });
    await repo.close();

    const adminToken = await loginAs(handler, admin.username, password);
    const modToken = await loginAs(handler, moderator.username, password);

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const uploadForm = new FormData();
    uploadForm.append("image", blob, "default.jpg");
    await handler(
      authedRequest("http://localhost/api/towkay/parameters/upload-placeholder", adminToken, {
        method: "POST",
        body: uploadForm,
      }),
      serveInfo,
    );

    const placeholderForm = new FormData();
    placeholderForm.append("type", "placeholder");
    const res = await handler(
      authedRequest("http://localhost/api/semak/display-override", modToken, {
        method: "POST",
        body: placeholderForm,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const stateRepo = await createTestRepository();
    const state = await stateRepo.getDisplayOverrideState();
    assertEquals(state?.type, "placeholder");
    assertEquals(state?.imageUrl, "/placeholders/default.jpg");
    await stateRepo.close();

    await cleanupTestData();
  },
});

Deno.test({
  name: "testReloadDisplay",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const form = new FormData();
    form.append("type", "reload");
    const res = await handler(
      authedRequest("http://localhost/api/semak/display-override", token, {
        method: "POST",
        body: form,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const repo = await createTestRepository();
    const logs = await repo.getAuditLog({ action_type: "reload_display" });
    assertEquals(logs.length, 1);
    await repo.close();

    await cleanupTestData();
  },
});

Deno.test({
  name: "testPanicDisplay",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const form = new FormData();
    form.append("type", "panic");
    const res = await handler(
      authedRequest("http://localhost/api/semak/display-override", token, {
        method: "POST",
        body: form,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const repo = await createTestRepository();
    const state = await repo.getDisplayOverrideState();
    assertEquals(state?.type, "blank");
    const logs = await repo.getAuditLog({ action_type: "panic_display" });
    assertEquals(logs.length, 1);
    await repo.close();

    await cleanupTestData();
  },
});
