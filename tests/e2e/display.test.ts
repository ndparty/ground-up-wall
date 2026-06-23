import { assertEquals } from "@std/assert";
import {
  authedRequest,
  cleanupTestData,
  createTestHandler,
  createTestRepository,
  createTestSubmission,
  loginAsAdmin,
  loginAsDisplayWall,
  loginAsModerator,
  serveInfo,
  setupModeratorAndDisplayWall,
  teardownTestDb,
} from "../helpers.ts";

Deno.test({
  name: "smoke: US-07 display wall user can view train",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const res = await handler(authedRequest("http://localhost/display", token), serveInfo);
    assertEquals(res.status, 200);
    const html = await res.text();
    assertEquals(html.includes("TrainDisplay") || html.includes("display-wall"), true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-07 unauthenticated user redirects to login",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/display"), serveInfo);
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "http://localhost/login");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-07 approved submissions returned in order",
  async fn() {
    const handler = await createTestHandler();
    const { moderator, displayWall } = await setupModeratorAndDisplayWall(handler);
    const first = await createTestSubmission({ submitter_name: "First" });
    const second = await createTestSubmission({ submitter_name: "Second" });
    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${first.id}`, moderator.token, {
        method: "POST",
      }),
      serveInfo,
    );
    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${second.id}`, moderator.token, {
        method: "POST",
      }),
      serveInfo,
    );

    const res = await handler(
      authedRequest("http://localhost/api/display/submissions", displayWall.token),
      serveInfo,
    );
    const body = await res.json();
    assertEquals(body.submissions.length, 2);
    assertEquals(body.submissions[0].submitter_name, "First");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-07 empty approved list",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const res = await handler(
      authedRequest("http://localhost/api/display/submissions", token),
      serveInfo,
    );
    const body = await res.json();
    assertEquals(body.submissions.length, 0);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-07 blank display override",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const blankForm = new FormData();
    blankForm.append("type", "blank");
    await handler(
      authedRequest("http://localhost/api/admin/display-override", token, {
        method: "POST",
        body: blankForm,
      }),
      serveInfo,
    );
    const state = await handler(
      authedRequest("http://localhost/api/display/override-state", token),
      serveInfo,
    );
    assertEquals((await state.json()).type, "blank");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-07 placeholder display override",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const uploadForm = new FormData();
    uploadForm.append("image", blob, "default.jpg");
    await handler(
      authedRequest("http://localhost/api/admin/parameters/upload-placeholder", token, {
        method: "POST",
        body: uploadForm,
      }),
      serveInfo,
    );

    const placeholderForm = new FormData();
    placeholderForm.append("type", "placeholder");
    await handler(
      authedRequest("http://localhost/api/admin/display-override", token, {
        method: "POST",
        body: placeholderForm,
      }),
      serveInfo,
    );
    const state = await handler(
      authedRequest("http://localhost/api/display/override-state", token),
      serveInfo,
    );
    const body = await state.json();
    assertEquals(body.type, "placeholder");
    assertEquals(body.imageUrl, "/placeholders/default.jpg");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-07 resume display override",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const blankForm = new FormData();
    blankForm.append("type", "blank");
    await handler(
      authedRequest("http://localhost/api/admin/display-override", token, {
        method: "POST",
        body: blankForm,
      }),
      serveInfo,
    );
    const resumeForm = new FormData();
    resumeForm.append("type", "resume");
    await handler(
      authedRequest("http://localhost/api/admin/display-override", token, {
        method: "POST",
        body: resumeForm,
      }),
      serveInfo,
    );
    const state = await handler(
      authedRequest("http://localhost/api/display/override-state", token),
      serveInfo,
    );
    assertEquals((await state.json()).type, "normal");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-08 new approval visible via submissions API",
  async fn() {
    const handler = await createTestHandler();
    const { moderator, displayWall } = await setupModeratorAndDisplayWall(handler);
    const submission = await createTestSubmission();
    const start = performance.now();
    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, moderator.token, {
        method: "POST",
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest("http://localhost/api/display/submissions", displayWall.token),
      serveInfo,
    );
    const elapsed = performance.now() - start;
    const body = await res.json();
    assertEquals(body.submissions.some((s: { id: string }) => s.id === submission.id), true);
    assertEquals(elapsed < 30_000, true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-15 pause command accepted",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/api/display/train-command", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pause" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-15 display wall user cannot publish train command",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const res = await handler(
      authedRequest("http://localhost/api/display/train-command", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pause" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 403);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-15 display wall user page hides moderator controls",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsDisplayWall(handler);
    const res = await handler(authedRequest("http://localhost/display", token), serveInfo);
    const html = await res.text();
    assertEquals(html.includes("Jump to cabin"), false);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-19 override state persists in database",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const blankForm = new FormData();
    blankForm.append("type", "blank");
    await handler(
      authedRequest("http://localhost/api/admin/display-override", token, {
        method: "POST",
        body: blankForm,
      }),
      serveInfo,
    );
    const repo = await createTestRepository();
    const state = await repo.getDisplayOverrideState();
    assertEquals(state?.type, "blank");
    await repo.close();
    await teardownTestDb();
  },
});
