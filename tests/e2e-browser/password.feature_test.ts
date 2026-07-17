import {
  captureVisualBaseline,
  getBaseUrl,
  loginAs,
  PWDCHANGE_PASSWORD,
  PWDCHANGE_USERNAME,
  runBrowserTest,
} from "./helpers.ts";

const NEW_VALID_PASSWORD = "newPassword123!";

async function credentialsWork(
  page: import("playwright").Page,
  password: string,
): Promise<boolean> {
  await page.context().clearCookies();
  await page.goto(getBaseUrl() + "/masuk");
  return await page.evaluate(
    async ([username, candidate]) => {
      const response = await fetch("/api/masuk/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: candidate }),
      });
      return response.ok;
    },
    [PWDCHANGE_USERNAME, password] as const,
  );
}

async function restoreKnownPassword(page: import("playwright").Page): Promise<void> {
  if (await credentialsWork(page, PWDCHANGE_PASSWORD)) return;
  if (!(await credentialsWork(page, NEW_VALID_PASSWORD))) {
    throw new Error("Password cleanup could not authenticate with either known credential");
  }

  await page.goto(getBaseUrl() + "/tukar");
  await page.waitForSelector("h2", { timeout: 10_000 });
  await page.fill('input[name="currentPassword"]', NEW_VALID_PASSWORD);
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
  if (!(await credentialsWork(page, PWDCHANGE_PASSWORD))) {
    throw new Error("Password cleanup did not restore the original credential");
  }
}

Deno.test({
  name: "Feature 5: Change Password - US-11 (all scenarios)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 5: Change Password - US-11 (all scenarios)",
      async ({ page }) => {
        let currentPassword = PWDCHANGE_PASSWORD;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          await restoreKnownPassword(page);
          await page.context().clearCookies();
          await loginAs(page, PWDCHANGE_USERNAME, PWDCHANGE_PASSWORD);

          await page.goto(getBaseUrl() + "/tukar");
          await page.waitForSelector("h2");
          await captureVisualBaseline(page, "password-form-static");

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
          await captureVisualBaseline(page, "password-success-static");
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
          await captureVisualBaseline(page, "password-wrong-current-static");

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
          await captureVisualBaseline(page, "password-mismatch-static");
        } catch (error) {
          testFailure = error;
        } finally {
          try {
            await restoreKnownPassword(page);
          } catch (error) {
            cleanupFailure = error;
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "Password scenarios and credential restoration both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
    );
  },
});
