import { assertEquals } from "@std/assert";
import type { Repository } from "../../lib/interfaces/repository.ts";
import type { AuditEntry } from "../../lib/types.ts";
import { PostgresRepository } from "../../lib/repositories/postgres_repository.ts";
import {
  authedRequest,
  cleanupTestData,
  createTestHandler,
  createTestRepository,
  createTestSubmission,
  loginAsModerator,
  makePhotoForm,
  serveInfo,
  submitViaApi,
  teardownTestDb,
} from "../helpers.ts";

const FORBIDDEN_AUDIT_METHODS = ["updateAuditEntry", "deleteAuditEntry"] as const;

Deno.test({
  name: "smoke: US-NFR-05 audit log has no update or delete methods",
  fn() {
    const protoNames = Object.getOwnPropertyNames(PostgresRepository.prototype);

    for (const method of FORBIDDEN_AUDIT_METHODS) {
      assertEquals(protoNames.includes(method), false);
    }

    const _typeCheck: Pick<Repository, "createAuditEntry" | "getAuditLog"> = {
      createAuditEntry: (): Promise<AuditEntry> => {
        throw new Error("not implemented");
      },
      getAuditLog: (): Promise<AuditEntry[]> => Promise.resolve([]),
    };
    void _typeCheck;
  },
});

Deno.test({
  name: "smoke: US-NFR-03 admin API not publicly accessible",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/api/towkay/users"), serveInfo);
    assertEquals(res.status, 401);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-NFR-03 admin page not accessible to moderators",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(authedRequest("http://localhost/towkay", token), serveInfo);
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "http://localhost/semak");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-NFR-03 image upload validation rejects oversize file",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([big], "big.jpg", { type: "image/jpeg" });
    const res = await submitViaApi(
      handler,
      makePhotoForm({ photo: file, message: "Hi", submitter_name: "Alex" }),
    );
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-NFR-05 auditable approve action is logged",
  async fn() {
    const handler = await createTestHandler();
    const { token, userId } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    await handler(
      authedRequest(`http://localhost/api/semak/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    const repo = await createTestRepository();
    const logs = await repo.getAuditLog({ action_type: "approve", moderator_id: userId });
    assertEquals(logs.length >= 1, true);
    await repo.close();
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-NFR-02 loads many approved submissions quickly",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      const sub = await createTestSubmission({ submitter_name: `User ${i}` });
      ids.push(sub.id);
      await handler(
        authedRequest(`http://localhost/api/semak/approve/${sub.id}`, token, {
          method: "POST",
        }),
        serveInfo,
      );
    }
    const start = performance.now();
    const res = await handler(
      authedRequest("http://localhost/api/concourse/submissions", token),
      serveInfo,
    );
    const elapsed = performance.now() - start;
    assertEquals(res.status, 200);
    assertEquals((await res.json()).submissions.length, 50);
    assertEquals(elapsed < 5000, true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-NFR-01 upload page has mobile viewport and upload styles",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/muatnaik"), serveInfo);
    const html = await res.text();
    assertEquals(html.includes("width=device-width"), true);
    assertEquals(html.includes("viewport-fit=cover"), true);
    assertEquals(html.includes("upload") || html.includes("Upload"), true);
    const css = await Deno.readTextFile("static/upload.css");
    assertEquals(css.includes("upload-privacy-notice"), true);
    assertEquals(
      css.includes("btn--touch") ||
        (await Deno.readTextFile("static/app.css")).includes("btn--touch"),
      true,
    );
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-NFR-01 train stylesheet defines cabin typography",
  async fn() {
    const css = await Deno.readTextFile("static/train.css");
    assertEquals(css.includes("font-size"), true);
    assertEquals(css.includes("cabin"), true);
    await teardownTestDb();
  },
});
