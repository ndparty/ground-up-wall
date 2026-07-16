/**
 * Smoke / structural checks only — NOT NFR acceptance.
 *
 * Vacuous FPS/latency budgets were removed. Real NFR gates belong in a follow-up
 * with measured baselines. Do not treat a green run here as US-NFR sign-off.
 */

import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { DISPLAY_PASSWORD, DISPLAY_USERNAME, loginAs, loginAsAdmin } from "./helpers.ts";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

Deno.test({
  name: "smoke (NFR demoted): upload form mounts on mobile viewport",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    try {
      await page.goto(getBaseUrl() + "/muatnaik");
      await page.waitForSelector("form");

      const photoInput = await page.$('input[type="file"][accept*="image"]');
      const messageInput = await page.$("textarea");
      const nameInput = await page.$('label[data-field="submitter_name"] input');
      const submitButton = await page.$('button[type="submit"]');

      assertEquals(photoInput !== null, true, "smoke: photo input present on mobile");
      assertEquals(messageInput !== null, true, "smoke: message input present on mobile");
      assertEquals(nameInput !== null, true, "smoke: name input present on mobile");
      assertEquals(submitButton !== null, true, "smoke: submit button present on mobile");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "smoke (NFR demoted): display wall cabins mount after login",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    try {
      await loginAs(page, DISPLAY_USERNAME, DISPLAY_PASSWORD);
      await page.goto(getBaseUrl() + "/concourse");
      await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
      assertEquals(
        await page.locator(".train-cabin-wrap").count() > 0,
        true,
        "smoke: at least one cabin mounts",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "smoke (NFR demoted): protected routes redirect to login",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      const protectedRoutes = [
        "/semak",
        "/semak/pamer",
        "/towkay",
        "/towkay/users",
        "/towkay/parameters",
        "/towkay/audit-log",
        "/towkay/display-override",
        "/concourse",
        "/tukar",
      ];

      for (const route of protectedRoutes) {
        await page.goto(getBaseUrl() + route);
        assertEquals(
          page.url().includes("/masuk"),
          true,
          `smoke: ${route} redirects to login when unauthenticated`,
        );
      }
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "smoke (NFR demoted): upload file input requires image accept",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(getBaseUrl() + "/muatnaik");
      await page.waitForSelector("form");

      const fileInput = await page.$('input[type="file"]');
      const acceptAttr = await fileInput?.getAttribute("accept");
      assertEquals(
        typeof acceptAttr === "string" && acceptAttr.includes("image"),
        true,
        "smoke: file input accept attribute must include image",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "smoke (NFR demoted): health + public pages load",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      const response = await page.request.get(getBaseUrl() + "/api/health");
      assertEquals(response.ok(), true, "smoke: health endpoint responds");

      await page.goto(getBaseUrl() + "/muatnaik");
      await page.waitForSelector("form");

      await page.goto(getBaseUrl() + "/masuk");
      await page.waitForSelector("form");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "smoke (NFR demoted): audit log page is read-only UI",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await loginAsAdmin(page);
      await page.goto(getBaseUrl() + "/towkay/audit-log");
      await page.waitForSelector(".filter-bar, .data-table, h2", { timeout: 10_000 });

      const editDeleteButtons = await page.locator(
        'button:has-text("Edit"), button:has-text("Delete")',
      ).count();
      assertEquals(
        editDeleteButtons,
        0,
        "smoke: audit log has no edit or delete buttons",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
