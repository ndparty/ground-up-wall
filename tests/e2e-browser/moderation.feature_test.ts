import { chromium, type Page } from "playwright";
import { assertEquals, assertGreater } from "@std/assert";
import { loginAsAdmin } from "./helpers.ts";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

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

Deno.test({
  name: "Feature 2: Login Page - US-03",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
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
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "Feature 2: Moderation Queue - US-04",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(getBaseUrl() + "/semak");
      await page.waitForURL(/\/masuk/);

      const body = await page.textContent("body") ?? "";
      assertEquals(
        body.includes("Sign in") || body.includes("Login") || body.includes("username"),
        true,
        "US-04: Unauthenticated access redirects to login",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "Feature 2: Moderation Actions - US-05",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await loginAsAdmin(page);
      await page.goto(getBaseUrl() + "/semak");
      await page.waitForURL(/\/semak/);
      await waitForModerationQueueReady(page);
      assertEquals(
        page.url().includes("/semak") && !page.url().includes("/masuk"),
        true,
        "US-05: authenticated moderation queue page renders",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "Feature 2: Auto-Moderator Flagging - US-12",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await loginAsAdmin(page);
      await page.goto(getBaseUrl() + "/semak");
      await page.waitForURL(/\/semak/);
      await waitForModerationQueueReady(page);

      assertEquals(
        page.url().includes("/masuk"),
        false,
        "US-12: moderation queue requires authenticated session",
      );

      const flaggedCards = page.locator(".submission-card--flagged");
      const flaggedCount = await flaggedCards.count();
      if (flaggedCount > 0) {
        const approveBtn = flaggedCards.first().locator(".btn--approve");
        assertGreater(
          await approveBtn.count(),
          0,
          "US-12: flagged submission exposes an approve action",
        );
        await approveBtn.first().click();
        await page.waitForTimeout(1_000);
        const afterMsg = await page.textContent("body") ?? "";
        assertEquals(
          afterMsg.includes("Failed to") || afterMsg.includes("Request failed"),
          false,
          "US-12: approving flagged submission succeeds without error",
        );
      } else {
        const cardCount = await page.locator(".submission-card").count();
        const emptyPending = page.locator(".text-muted", { hasText: "No pending submissions" });
        assertEquals(
          cardCount > 0 || (await emptyPending.count()) > 0,
          true,
          "US-12: moderation queue shows cards or empty state after island load",
        );
      }
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "Feature 2: Delete Approved Submission - US-06",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("dialog", (dialog) => dialog.accept());
    try {
      await loginAsAdmin(page);

      await page.goto(getBaseUrl() + "/semak/pamer");
      await page.waitForURL(/\/semak\/pamer/);
      await waitForApprovedGalleryReady(page);
      assertEquals(
        page.url().includes("/masuk"),
        false,
        "US-06: approved gallery requires authenticated session",
      );

      const deleteButtons = page.locator("button.btn--dark", { hasText: "Delete" });
      const deleteCount = await deleteButtons.count();
      assertGreater(
        deleteCount,
        0,
        "US-06: approved gallery must have delete actions (run db:seed:demos)",
      );

      const initialCardCount = await page.locator(".submission-card").count();
      await deleteButtons.first().click();
      await page.waitForFunction(
        (before) => document.querySelectorAll(".submission-card").length < before,
        initialCardCount,
        { timeout: 10_000 },
      );
      const afterDeleteCount = await page.locator(".submission-card").count();
      assertEquals(
        afterDeleteCount < initialCardCount,
        true,
        "US-06: deleting an approved submission removes it from the gallery",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
