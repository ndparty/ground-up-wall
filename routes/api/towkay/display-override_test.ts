import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsAdmin,
  serveInfo,
} from "../../../lib/api/concourse_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../lib/test_helpers.ts";

Deno.test({
  name: "testBlankDisplayCommand",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const form = new FormData();
    form.append("type", "blank");
    const res = await handler(
      authedRequest("http://localhost/api/towkay/display-override", token, {
        method: "POST",
        body: form,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const repo = await createTestRepository();
    const state = await repo.getDisplayOverrideState();
    assertEquals(state?.type, "blank");
    const logs = await repo.getAuditLog({ action_type: "blank_display" });
    assertEquals(logs.length >= 1, true);
    await repo.close();
    await cleanupTestData();
  },
});

Deno.test({
  name: "testResumeDisplayCommand",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const form = new FormData();
    form.append("type", "resume");
    const res = await handler(
      authedRequest("http://localhost/api/towkay/display-override", token, {
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
  name: "testReloadDisplayCommand",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const form = new FormData();
    form.append("type", "reload");
    const res = await handler(
      authedRequest("http://localhost/api/towkay/display-override", token, {
        method: "POST",
        body: form,
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const repo = await createTestRepository();
    const logs = await repo.getAuditLog({ action_type: "reload_display" });
    assertEquals(logs.length >= 1, true);
    await repo.close();
    await cleanupTestData();
  },
});

Deno.test({
  name: "testPanicDisplayCommand",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const form = new FormData();
    form.append("type", "panic");
    const res = await handler(
      authedRequest("http://localhost/api/towkay/display-override", token, {
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
    assertEquals(logs.length >= 1, true);
    await repo.close();
    await cleanupTestData();
  },
});
