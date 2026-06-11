import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  serveInfo,
} from "../../../../lib/api/display_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../../lib/test_helpers.ts";

Deno.test({
  name: "testDeleteModerator",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("pass");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });
    await repo.createAuditEntry({
      moderator_id: mod.id,
      action_type: "approve",
      target_type: "submission",
      target_id: "sub-1",
    });

    const res = await handler(
      authedRequest("http://localhost/api/admin/users/delete", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, role: "moderator", confirmed: true }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const mods = await repo.listModerators();
    assertEquals(mods.some((m) => m.id === mod.id), false);
    const audit = await repo.getAuditLog({ action_type: "approve" });
    assertEquals(audit.length, 1);
    assertEquals(audit[0].target_id, "sub-1");
    await repo.close();
    await cleanupTestData();
  },
});
