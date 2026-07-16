import { type Page } from "playwright";
import { assertEquals, assertGreater } from "@std/assert";
import { formatWordListForEdit } from "../../lib/admin/parameter_validation.ts";
import { createSubmissionFixture, moderateFixture } from "./fixtures.ts";
import { captureVisualBaseline, getBaseUrl, loginAsAdmin, runBrowserTest } from "./helpers.ts";

/** Wait until the ModerationQueue island has finished loading (not just page-shell h2). */
async function waitForModerationQueueReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const loading = document.body?.textContent?.includes("Loading queue");
      if (loading) return false;
      const hasCards = document.querySelectorAll(".submission-card").length > 0;
      const emptyPending = document.body?.textContent?.includes("No pending submissions") ?? false;
      return hasCards || emptyPending;
    },
    { timeout: 15_000 },
  );
}

/** Wait until the approved gallery island has finished loading (not just static Gallery h2). */
async function waitForApprovedGalleryReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const loading = document.body?.textContent?.includes("Loading approved");
      if (loading) return false;
      const hasCards = document.querySelectorAll(".submission-card").length > 0;
      const empty = document.body?.textContent?.includes("No approved submissions") ?? false;
      return hasCards || empty;
    },
    { timeout: 15_000 },
  );
}

async function updateConfig(page: Page, key: string, value: string): Promise<void> {
  const result = await page.evaluate(async ({ key, value }) => {
    const response = await fetch("/api/towkay/parameters/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, { key, value });
  if (!result.ok) {
    throw new Error(`Config update failed for ${key}: HTTP ${result.status} ${result.text}`);
  }
}

async function getConfigValue(page: Page, key: string): Promise<string> {
  return await page.evaluate(async (key) => {
    const response = await fetch("/api/towkay/parameters");
    const rows = await response.json() as Array<{ key: string; value: string }>;
    const row = rows.find((candidate) => candidate.key === key);
    if (!row) throw new Error(`Missing config ${key}`);
    return row.value;
  }, key);
}

async function assertAuditAction(
  page: Page,
  actionType: string,
  submissionId: string,
): Promise<void> {
  const found = await page.evaluate(async ({ actionType, submissionId }) => {
    const response = await fetch(
      `/api/towkay/audit-log?action_type=${
        encodeURIComponent(actionType)
      }&target_type=submission&limit=200`,
    );
    const body = await response.json() as {
      entries: Array<{ action_type: string; target_id?: string }>;
    };
    return body.entries.some((item) =>
      item.action_type === actionType && item.target_id === submissionId
    );
  }, { actionType, submissionId });
  assertEquals(found, true, `Audit log records ${actionType} for ${submissionId}`);
}

Deno.test({
  name: "Feature 2: Login Page - US-03",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest("Feature 2: Login Page - US-03", async ({ page }) => {
      await page.goto(getBaseUrl() + "/masuk");
      await page.waitForSelector("form");

      const usernameInput = await page.$('input[name="username"]');
      const passwordInput = await page.$('input[name="password"]');
      const submitButton = await page.$('button[type="submit"]');

      assertEquals(usernameInput !== null, true, "US-03: Username input should exist");
      assertEquals(passwordInput !== null, true, "US-03: Password input should exist");
      assertEquals(submitButton !== null, true, "US-03: Submit button should exist");

      const heading = await page.textContent("h2");
      assertEquals(
        heading?.includes("Sign") || heading?.includes("sign"),
        true,
        "US-03: Login page should have sign-in heading",
      );
      await captureVisualBaseline(page, "login-form-static");
    });
  },
});

Deno.test({
  name: "Feature 2: Moderation Queue - US-04",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest("Feature 2: Moderation Queue - US-04", async ({ page }) => {
      await page.goto(getBaseUrl() + "/semak");
      await page.waitForURL(/\/masuk/);

      const body = await page.textContent("body") ?? "";
      assertEquals(
        body.includes("Sign in") || body.includes("Login") || body.includes("username"),
        true,
        "US-04: Unauthenticated access redirects to login",
      );
    });
  },
});

Deno.test({
  name: "Feature 2: Moderation Actions - US-05",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 2: Moderation Actions - US-05",
      async ({ page }) => {
        await loginAsAdmin(page);
        await page.goto(getBaseUrl() + "/semak");
        await page.waitForURL(/\/semak/);
        await waitForModerationQueueReady(page);
        assertEquals(
          page.url().includes("/semak") && !page.url().includes("/masuk"),
          true,
          "US-05: authenticated moderation queue page renders",
        );
      },
      {
        successScreenshot: "moderation-queue",
        visualBaseline: "moderation-queue",
      },
    );
  },
});

Deno.test({
  name: "Feature 2: Auto-Moderator Flagging - US-12",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 2: Auto-Moderator Flagging - US-12",
      async ({ page }) => {
        let fixtureId: string | null = null;
        let originalWords: string | null = null;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          await loginAsAdmin(page);
          originalWords = await getConfigValue(page, "auto_moderator_word_list");
          await updateConfig(page, "auto_moderator_word_list", "e2eflag");
          const fixture = await createSubmissionFixture(page, {
            name: "E2E Flagged Fixture",
            message: "This contains the e2eflag advisory token",
          });
          fixtureId = fixture.submission_id;
          assertEquals(fixture.is_flagged, true, "US-12: seeded flagged fixture is deterministic");

          await page.goto(getBaseUrl() + "/semak");
          await waitForModerationQueueReady(page);
          const flaggedCard = page.locator(
            `.submission-card--flagged[data-submission-id="${fixture.submission_id}"]`,
          );
          await flaggedCard.waitFor({ state: "visible", timeout: 15_000 });
          assertEquals(
            (await flaggedCard.locator(".submission-card__flag").textContent())?.includes(
              "e2eflag",
            ),
            true,
            "US-12: flagged indicator identifies the configured word",
          );
          assertEquals(
            await flaggedCard.locator("mark.submission-card__highlight", {
              hasText: "e2eflag",
            }).count() > 0,
            true,
            "US-12: configured word is highlighted for advisory review",
          );
          await captureVisualBaseline(page, "moderation-flagged-static", {
            mask: [".submission-card__time"],
          });

          await flaggedCard.locator(".btn--approve").click();
          await flaggedCard.waitFor({ state: "hidden", timeout: 15_000 });
          await assertAuditAction(page, "approve", fixture.submission_id);
        } catch (error) {
          testFailure = error;
        } finally {
          const cleanupErrors: unknown[] = [];
          if (fixtureId) {
            try {
              await moderateFixture(page, "delete", fixtureId);
            } catch (error) {
              cleanupErrors.push(error);
            }
          }
          if (originalWords !== null) {
            try {
              await updateConfig(
                page,
                "auto_moderator_word_list",
                formatWordListForEdit(originalWords),
              );
              const restored = await getConfigValue(page, "auto_moderator_word_list");
              if (restored !== originalWords) {
                cleanupErrors.push(
                  new Error("Auto-moderator word-list restoration did not verify"),
                );
              }
            } catch (error) {
              cleanupErrors.push(error);
            }
          }
          if (cleanupErrors.length > 0) {
            cleanupFailure = new AggregateError(cleanupErrors, "US-12 fixture cleanup failed");
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "US-12 behavior and shared-state cleanup both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { acceptDialogs: true },
    );
  },
});

Deno.test({
  name: "Feature 2: Moderation lifecycle - US-05",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 2: Moderation lifecycle - US-05",
      async ({ page }) => {
        const fixtureIds = new Set<string>();
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          await loginAsAdmin(page);
          const approveFixture = await createSubmissionFixture(page, {
            name: "E2E Approve Fixture",
            message: "Pending message before edit",
          });
          fixtureIds.add(approveFixture.submission_id);
          const rejectFixture = await createSubmissionFixture(page, {
            name: "E2E Reject Fixture",
            message: "Reject this deterministic fixture",
          });
          fixtureIds.add(rejectFixture.submission_id);

          await page.goto(getBaseUrl() + "/semak");
          await waitForModerationQueueReady(page);
          const approveCard = page.locator(
            `.submission-card[data-submission-id="${approveFixture.submission_id}"]`,
          );
          await approveCard.waitFor({ state: "visible", timeout: 15_000 });
          await approveCard.locator("button", { hasText: "Edit" }).click();
          await approveCard.locator('textarea[aria-label="Submission message"]').fill(
            "Pending message after edit",
          );
          await approveCard.locator("button", { hasText: "Save" }).click();
          await approveCard.locator(".submission-card__message", {
            hasText: "Pending message after edit",
          }).waitFor({ state: "visible", timeout: 15_000 });
          await assertAuditAction(page, "edit", approveFixture.submission_id);
          const pendingAfterEdit = await page.evaluate(async (submissionId) => {
            const response = await fetch("/api/semak/pending");
            const submissions = await response.json() as Array<{
              id: string;
              status: string;
              message: string;
            }>;
            const found = submissions.find((submission) => submission.id === submissionId);
            return found
              ? { id: found.id, status: found.status, message: found.message }
              : undefined;
          }, approveFixture.submission_id);
          assertEquals(
            pendingAfterEdit,
            {
              id: approveFixture.submission_id,
              status: "pending",
              message: "Pending message after edit",
            },
            "US-05: pending edit preserves pending status and updates content",
          );

          await approveCard.locator("button", { hasText: "Approve" }).click();
          await approveCard.waitFor({ state: "hidden", timeout: 15_000 });
          await assertAuditAction(page, "approve", approveFixture.submission_id);

          const rejectCard = page.locator(
            `.submission-card[data-submission-id="${rejectFixture.submission_id}"]`,
          );
          await rejectCard.locator("button", { hasText: "Reject" }).click();
          await rejectCard.waitFor({ state: "hidden", timeout: 15_000 });
          await assertAuditAction(page, "reject", rejectFixture.submission_id);

          await page.goto(getBaseUrl() + "/semak/pamer");
          await waitForApprovedGalleryReady(page);
          await page.locator('input[aria-label="Search approved submissions"]').fill(
            approveFixture.submission_id,
          );
          const approvedCard = page.locator(
            `.submission-card[data-submission-id="${approveFixture.submission_id}"]`,
          );
          await approvedCard.waitFor({ state: "visible", timeout: 15_000 });
          await approvedCard.locator("button", { hasText: "Edit" }).click();
          await approvedCard.locator('textarea[aria-label="Submission message"]').fill(
            "Approved message after edit",
          );
          await approvedCard.locator("button", { hasText: "Save" }).click();
          await approvedCard.locator(".submission-card__message", {
            hasText: "Approved message after edit",
          }).waitFor({ state: "visible", timeout: 15_000 });
          await assertAuditAction(page, "edit", approveFixture.submission_id);

          const displaySubmissions = await page.evaluate(async () => {
            const response = await fetch("/api/concourse/submissions");
            return await response.json() as {
              submissions: Array<{ id: string; message: string }>;
            };
          });
          const approvedDisplayItem = displaySubmissions.submissions.find((submission) =>
            submission.id === approveFixture.submission_id
          );
          assertEquals(
            approvedDisplayItem?.message,
            "Approved message after edit",
            "US-05: approved edit propagates to the display feed",
          );
          assertEquals(
            displaySubmissions.submissions.some((submission) =>
              submission.id === rejectFixture.submission_id
            ),
            false,
            "US-05: rejected fixture stays out of the display feed",
          );
        } catch (error) {
          testFailure = error;
        } finally {
          const cleanupErrors: unknown[] = [];
          if (!page.url().startsWith(getBaseUrl())) {
            try {
              await page.goto(getBaseUrl() + "/masuk");
            } catch (error) {
              cleanupErrors.push(error);
            }
          }
          for (const submissionId of fixtureIds) {
            try {
              await moderateFixture(page, "delete", submissionId);
            } catch (error) {
              cleanupErrors.push(error);
            }
          }
          if (cleanupErrors.length > 0) {
            cleanupFailure = new AggregateError(
              cleanupErrors,
              "Moderation fixture cleanup failed",
            );
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "Moderation lifecycle and fixture cleanup both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { acceptDialogs: true },
    );
  },
});

Deno.test({
  name: "Feature 2: Delete Approved Submission - US-06",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 2: Delete Approved Submission - US-06",
      async ({ page }) => {
        let fixtureId: string | null = null;
        let deleted = false;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          await loginAsAdmin(page);
          const fixture = await createSubmissionFixture(page, {
            name: "E2E Delete Fixture",
            message: "Delete only this approved fixture",
          });
          fixtureId = fixture.submission_id;
          await moderateFixture(page, "approve", fixture.submission_id);

          await page.goto(getBaseUrl() + "/semak/pamer");
          await page.waitForURL(/\/semak\/pamer/);
          await waitForApprovedGalleryReady(page);
          await page.locator('input[aria-label="Search approved submissions"]').fill(
            fixture.submission_id,
          );
          assertEquals(
            page.url().includes("/masuk"),
            false,
            "US-06: approved gallery requires authenticated session",
          );

          await page.waitForSelector(".approved-toolbar__count", { timeout: 10_000 });
          const countLabel = await page.locator(".approved-toolbar__count").textContent() ?? "";
          const initialTotal = Number.parseInt(countLabel, 10);
          assertGreater(
            initialTotal,
            0,
            "US-06: approved gallery must list the fixture",
          );
          await captureVisualBaseline(page, "moderation-approved-gallery-static", {
            mask: [
              'input[aria-label="Search approved submissions"]',
              ".submission-card__time",
            ],
          });

          const fixtureCard = page.locator(
            `.submission-card[data-submission-id="${fixture.submission_id}"]`,
          );
          await fixtureCard.waitFor({ state: "visible", timeout: 15_000 });
          const deleteButtons = fixtureCard.locator("button.btn--dark", { hasText: "Delete" });
          assertGreater(
            await deleteButtons.count(),
            0,
            "US-06: approved gallery must have delete actions",
          );

          await deleteButtons.click();
          await page.waitForFunction(
            (before) => {
              const text = document.querySelector(".approved-toolbar__count")?.textContent ?? "";
              const n = Number.parseInt(text, 10);
              return Number.isFinite(n) && n < before;
            },
            initialTotal,
            { timeout: 15_000 },
          );
          deleted = true;
          const afterLabel = await page.locator(".approved-toolbar__count").textContent() ?? "";
          const afterTotal = Number.parseInt(afterLabel, 10);
          assertEquals(
            afterTotal < initialTotal,
            true,
            "US-06: deleting an approved submission reduces the gallery total",
          );
        } catch (error) {
          testFailure = error;
        } finally {
          if (fixtureId && !deleted) {
            try {
              await moderateFixture(page, "delete", fixtureId);
            } catch (error) {
              cleanupFailure = error;
            }
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "US-06 delete behavior and fixture cleanup both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { acceptDialogs: true },
    );
  },
});
