import { assertEquals } from "@std/assert";
import {
  authedRequest,
  cleanupTestData,
  createTestHandler,
  createTestSubmission,
  loginAsModerator,
  serveInfo,
  teardownTestDb,
} from "../helpers.ts";

Deno.test({
  name: "smoke: US-03 login with valid credentials",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(authedRequest("http://localhost/moderate", token), serveInfo);
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-03 login with invalid credentials",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const res = await handler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "nobody", password: "wrong" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 401);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-03 access without login redirects",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/moderate"), serveInfo);
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "http://localhost/login");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-04 view pending submissions",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    await createTestSubmission();
    const res = await handler(
      authedRequest("http://localhost/api/moderate/pending", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.length >= 1, true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-04 empty pending queue",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/api/moderate/pending", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.length, 0);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-05 approve submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).status, "approved");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-05 reject submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/reject/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const pending = await handler(
      authedRequest("http://localhost/api/moderate/pending", token),
      serveInfo,
    );
    const list = await pending.json();
    assertEquals(list.some((s: { id: string }) => s.id === submission.id), false);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-05 edit pending submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/edit/${submission.id}`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Edited message", submitter_name: "New Name" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).message, "Edited message");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-05 edit approved submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/edit/${submission.id}`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Approved edit", submitter_name: "Name" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-06 delete approved submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/delete/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const approved = await handler(
      authedRequest("http://localhost/api/moderate/approved", token),
      serveInfo,
    );
    const list = await approved.json();
    assertEquals(list.some((s: { id: string }) => s.id === submission.id), false);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-12 flagged submission in queue",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    await createTestSubmission({ message: "what the hell", submitter_name: "User" });
    const res = await handler(
      authedRequest("http://localhost/api/moderate/pending", token),
      serveInfo,
    );
    const body = await res.json();
    assertEquals(body.some((s: { is_flagged: boolean }) => s.is_flagged), true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-12 can approve flagged submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission({
      message: "oh damn",
      submitter_name: "User",
    });
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});
