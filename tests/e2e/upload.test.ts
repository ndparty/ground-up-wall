import { assertEquals, assertStringIncludes } from "@std/assert";
import { PRIVACY_NOTICE } from "../../lib/copy/privacy_notice.ts";
import { POSTING_GUIDELINES_DISCLAIMER } from "../../lib/copy/disclaimers.ts";
import {
  cleanupTestData,
  createTestHandler,
  createTestRepository,
  makePhotoForm,
  serveInfo,
  submitViaApi,
  testPhoto,
  teardownTestDb,
} from "../helpers.ts";

Deno.test({
  name: "smoke: US-01 valid submit",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const form = makePhotoForm({
      photo: testPhoto(),
      message: "Celebrating together",
      submitter_name: "Alex",
    });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.status, "pending");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-01 submit with social handle",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const form = makePhotoForm({
      photo: testPhoto(),
      message: "Hello",
      submitter_name: "Alex",
      social_handle: "@alex_ndp",
    });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 201);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-01 message exceeds character limit",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const form = makePhotoForm({
      photo: testPhoto(),
      message: "x".repeat(51),
      submitter_name: "Alex",
    });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-01 message exceeds word limit",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const repo = await createTestRepository();
    await repo.upsertSystemConfig("message_length_limit", "3", "test");
    await repo.upsertSystemConfig("message_length_unit", "words", "test");
    await repo.close();

    const form = makePhotoForm({
      photo: testPhoto(),
      message: "one two three four",
      submitter_name: "Alex",
    });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-01 submit without photo",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const form = makePhotoForm({ message: "Hi", submitter_name: "Alex" });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-01 invalid file type",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const bad = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
    const form = makePhotoForm({ photo: bad, message: "Hi", submitter_name: "Alex" });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-02a upload page renders form",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/upload"), serveInfo);
    assertEquals(res.status, 200);
    const html = await res.text();
    assertStringIncludes(html, "Share your moment");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-02a upload counter shows remaining characters",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/upload"), serveInfo);
    const html = await res.text();
    assertStringIncludes(html, "50 characters remaining");
    assertEquals(html.includes("NaN"), false);
    assertStringIncludes(html, "Share your National Day moment!");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-02a upload counter shows remaining words",
  async fn() {
    const handler = await createTestHandler();
    const repo = await createTestRepository();
    await repo.upsertSystemConfig("message_length_limit", "3", "test");
    await repo.upsertSystemConfig("message_length_unit", "words", "test");
    await repo.close();

    const res = await handler(new Request("http://localhost/upload"), serveInfo);
    const html = await res.text();
    assertStringIncludes(html, "3 words remaining");
    assertEquals(html.includes("characters remaining"), false);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-02a privacy notice on upload page",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/upload"), serveInfo);
    const html = await res.text();
    assertStringIncludes(html, PRIVACY_NOTICE.slice(0, 40));
    assertStringIncludes(html, "social media");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-02a posting guidelines disclaimer",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/upload"), serveInfo);
    const html = await res.text();
    assertStringIncludes(html, POSTING_GUIDELINES_DISCLAIMER.slice(0, 30));
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-02a acknowledgment checkbox present",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/upload"), serveInfo);
    const html = await res.text();
    assertStringIncludes(html, "privacy notice and posting guidelines");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-01 flagged message still accepted",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const repo = await createTestRepository();
    await repo.upsertSystemConfig("auto_moderator_word_list", '["damn"]', "test");
    await repo.close();

    const form = makePhotoForm({
      photo: testPhoto(),
      message: "oh damn",
      submitter_name: "Alex",
    });
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.is_flagged, true);
    await teardownTestDb();
  },
});
