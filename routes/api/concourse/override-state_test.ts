import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsDisplayWall,
  serveInfo,
} from "../../../lib/api/concourse_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../../../lib/test_helpers.ts";

Deno.test({
  name: "testReturnsNormalDefault",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const res = await handler(
      authedRequest("http://localhost/api/concourse/override-state", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.type, "normal");
    await cleanupTestData();
  },
});

Deno.test({
  name: "testReturnsBlankState",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const repo = await createTestRepository();
    await repo.setDisplayOverrideState({
      type: "blank",
      commanded_by: "admin-1",
      commanded_at: new Date().toISOString(),
    });
    await repo.close();

    const res = await handler(
      authedRequest("http://localhost/api/concourse/override-state", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.type, "blank");
    await cleanupTestData();
  },
});

Deno.test({
  name: "testResolvesDefaultPlaceholder",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const repo = await createTestRepository();
    await repo.upsertSystemConfig(
      "default_placeholder_image",
      "/placeholders/default.jpg",
      "admin-1",
    );
    await repo.setDisplayOverrideState({
      type: "placeholder",
      commanded_by: "admin-1",
      commanded_at: new Date().toISOString(),
    });
    await repo.close();

    const res = await handler(
      authedRequest("http://localhost/api/concourse/override-state", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.type, "placeholder");
    assertEquals(body.imageUrl, "/placeholders/default.jpg");
    await cleanupTestData();
  },
});
