import {
  getBaseUrl,
  loginAs,
  PWDCHANGE_PASSWORD,
  PWDCHANGE_USERNAME,
  runBrowserTest,
} from "./helpers.ts";

const NEW_VALID_PASSWORD = "newPassword123!";

Deno.test({
  name: "Feature 5: Change Password - US-11 (all scenarios)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 5: Change Password - US-11 (all scenarios)",
      async ({ page }) => {
        let currentPassword = PWDCHANGE_PASSWORD;
        try {
          await loginAs(page, PWDCHANGE_USERNAME, PWDCHANGE_PASSWORD);

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
        }
      },
    );
  },
});
