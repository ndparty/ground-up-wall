import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import { AuthService } from "../../../../lib/services/auth_service.ts";
import { AuditServiceImpl } from "../../../../lib/services/audit_service_impl.ts";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  serveInfo,
} from "../../../../lib/api/display_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../../lib/test_helpers.ts";

Deno.test({
  name: "testDisableModerator",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("pass123");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });

    const res = await handler(
      authedRequest("http://localhost/api/admin/users/toggle-status", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, action: "disable", role: "moderator" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const auth = new AuthService(repo, new AuditServiceImpl(repo));
    const login = await auth.login(mod.username, "pass123");
    assertEquals(login.success, false);
    await repo.close();
    await cleanupTestData();
  },
});

Deno.test({
  name: "testEnableModerator",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("pass123");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });
    await repo.disableModerator(mod.id);

    await handler(
      authedRequest("http://localhost/api/admin/users/toggle-status", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, action: "enable", role: "moderator" }),
      }),
      serveInfo,
    );

    const auth = new AuthService(repo, new AuditServiceImpl(repo));
    const login = await auth.login(mod.username, "pass123");
    assertEquals(login.success, true);
    await repo.close();
    await cleanupTestData();
  },
});
