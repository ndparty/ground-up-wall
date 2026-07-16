import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { loginAs, PWDCHANGE_PASSWORD, PWDCHANGE_USERNAME } from "./helpers.ts";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

const NEW_VALID_PASSWORD = "newPassword123!";

Deno.test({
  name: "Feature 5: Change Password - US-11 (all scenarios)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let currentPassword = PWDCHANGE_PASSWORD;
    try {
      // Dedicated seeded user — never mutate admin/moderator shared by other suites.
      await loginAs(page, PWDCHANGE_USERNAME, PWDCHANGE_PASSWORD);

      // === Scenario 1: Successful password change ===
      await page.goto(getBaseUrl() + "/tukar");
      await page.waitForSelector("h2");

      await page.fill('input[name="currentPassword"]', currentPassword);
      await page.fill('input[name="newPassword"]', NEW_VALID_PASSWORD);
      await page.fill('input[name="confirmPassword"]', NEW_VALID_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => {
          const body = document.body?.textContent ?? "";
          return body.includes("Password updated") || body.includes("successfully") ||
            body.includes("success");
        },
        { timeout: 10_000 },
      );
      currentPassword = NEW_VALID_PASSWORD;

      // === Scenario 2: Incorrect current password ===
      await page.fill('input[name="currentPassword"]', "wrongPassword!!");
      await page.fill('input[name="newPassword"]', "anotherNewPass123!");
      await page.fill('input[name="confirmPassword"]', "anotherNewPass123!");
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => {
          const body = document.body?.textContent ?? "";
          return body.includes("incorrect") || body.includes("Current password");
        },
        { timeout: 10_000 },
      );

      // === Scenario 3: Password mismatch ===
      await page.fill('input[name="currentPassword"]', currentPassword);
      await page.fill('input[name="newPassword"]', "mismatchPass12!");
      await page.fill('input[name="confirmPassword"]', "someOtherPass123!");
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => {
          const body = document.body?.textContent ?? "";
          return body.includes("not match") || body.includes("do not match") ||
            body.includes("mismatch");
        },
        { timeout: 10_000 },
      );
    } finally {
      // Restore seeded password so re-runs and other jobs stay green.
      try {
        if (currentPassword !== PWDCHANGE_PASSWORD) {
          await page.goto(getBaseUrl() + "/tukar");
          await page.waitForSelector("h2", { timeout: 10_000 });
          await page.fill('input[name="currentPassword"]', currentPassword);
          await page.fill('input[name="newPassword"]', PWDCHANGE_PASSWORD);
          await page.fill('input[name="confirmPassword"]', PWDCHANGE_PASSWORD);
          await page.click('button[type="submit"]');
          await page.waitForFunction(
            () => {
              const body = document.body?.textContent ?? "";
              return body.includes("Password updated") || body.includes("successfully") ||
                body.includes("success");
            },
            { timeout: 10_000 },
          );
        }
      } catch (err) {
        console.error("Failed to restore pwdchange password:", err);
        throw err;
      }
      await browser.close();
      stopServer();
    }
  },
});
