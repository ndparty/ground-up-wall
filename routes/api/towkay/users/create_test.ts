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
  name: "testCreateModerator",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const username = `mod_${crypto.randomUUID().slice(0, 8)}`;
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "secret123456", role: "moderator" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 201);
    await cleanupTestData();
  },
});

Deno.test({
  name: "testCreateDisplayWallUser",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const username = `dw_${crypto.randomUUID().slice(0, 8)}`;
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "secret123456", role: "display_wall" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 201);
    await cleanupTestData();
  },
});

Deno.test({
  name: "testCreateDuplicateUsername",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const username = `dup_${crypto.randomUUID().slice(0, 8)}`;
    const body = JSON.stringify({ username, password: "secret123456", role: "moderator" });
    await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      serveInfo,
    );
    assertEquals(res.status, 409);
    await cleanupTestData();
  },
});
