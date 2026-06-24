import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  serveInfo,
} from "../../../../lib/api/concourse_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../../lib/test_helpers.ts";

Deno.test({
  name: "testResetModeratorPassword",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("oldpass");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });

    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/reset-password", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: mod.id,
          newPassword: "newpass123456",
          role: "moderator",
        }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const user = await repo.authenticateUser(mod.username);
    assertEquals(await bcrypt.verify("newpass123456", user!.password_hash), true);

    const logs = await repo.getAuditLog({ action_type: "reset_password" });
    assertEquals(logs.some((e) => e.target_id === mod.id), true);
    await repo.close();
    await cleanupTestData();
  },
});
