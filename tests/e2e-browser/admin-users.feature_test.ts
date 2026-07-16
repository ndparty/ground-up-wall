import { assertEquals, assertGreater } from "@std/assert";
import { captureVisualBaseline, getBaseUrl, loginAsAdmin, runBrowserTest } from "./helpers.ts";

Deno.test({
  name: "Feature 4: Admin Users (US-09, US-10, US-16, US-18)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 4: Admin Users (US-09, US-10, US-16, US-18)",
      async ({ page }) => {
        const createdUsernames: string[] = [];
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          await page.goto(getBaseUrl() + "/towkay/users");
          await page.waitForURL(/\/masuk/);
          const loginBody = await page.textContent("body") ?? "";
          const hasLoginContent = loginBody.includes("Masuk") || loginBody.includes("Login") ||
            loginBody.includes("username");
          assertEquals(hasLoginContent, true, "US-10: unauthenticated access redirects to login");

          await loginAsAdmin(page);

          await page.goto(getBaseUrl() + "/towkay/users");
          await page.waitForSelector(".data-table, .text-muted", { timeout: 10_000 });
          await page.waitForSelector(".data-table__row", { timeout: 10_000 });

          const initialRows = await page.locator(".data-table__row").count();
          assertGreater(initialRows, 0, "US-10: at least one managed user should be listed");
          await captureVisualBaseline(page, "admin-users-static", {
            mask: [".data-table__row td:nth-child(4)"],
          });

          const modUsername = `e2e_mod_${Date.now()}`;
          createdUsernames.push(modUsername);
          await page.fill('input[aria-label="New account username"]', modUsername);
          await page.fill('input[aria-label="New account password"]', "temppass1234");
          await page.selectOption('select[aria-label="New account role"]', "moderator");
          await page.click("button.btn--primary");
          await page.locator(".data-table__row", { hasText: modUsername }).waitFor({
            state: "visible",
            timeout: 15_000,
          });
          assertEquals(
            await page.locator(".data-table__row", { hasText: modUsername }).count() > 0,
            true,
            "US-09: created moderator appears in the list",
          );

          const dwUsername = `e2e_dw_${Date.now()}`;
          createdUsernames.push(dwUsername);
          await page.fill('input[aria-label="New account username"]', dwUsername);
          await page.fill('input[aria-label="New account password"]', "temppass1234");
          await page.selectOption('select[aria-label="New account role"]', "display_wall");
          await page.click("button.btn--primary");
          await page.locator(".data-table__row", { hasText: dwUsername }).waitFor({
            state: "visible",
            timeout: 15_000,
          });
          assertEquals(
            await page.locator(".data-table__row", { hasText: dwUsername }).count() > 0,
            true,
            "US-16: created display-wall account appears in the list",
          );

          const modRow = page.locator(".data-table__row", { hasText: modUsername });
          await modRow.locator("button", { hasText: "Toggle" }).click();
          await modRow.locator(".text-status-disabled").waitFor({
            state: "visible",
            timeout: 15_000,
          });
          assertEquals(
            await modRow.locator(".text-status-disabled").count() > 0,
            true,
            "US-18: moderator account can be disabled",
          );

          const dwRow = page.locator(".data-table__row", { hasText: dwUsername });
          await dwRow.locator("button", { hasText: "Delete" }).click();
          await page.locator(".data-table__row", { hasText: dwUsername }).waitFor({
            state: "hidden",
            timeout: 15_000,
          });
          assertEquals(
            await page.locator(".data-table__row", { hasText: dwUsername }).count() === 0,
            true,
            "US-18: display-wall account can be deleted",
          );

          await modRow.locator("button", { hasText: "Delete" }).click();
          await page.locator(".data-table__row", { hasText: modUsername }).waitFor({
            state: "hidden",
            timeout: 15_000,
          });
        } catch (error) {
          testFailure = error;
        } finally {
          try {
            const cleanupResult = await page.evaluate(async (usernames) => {
              const errors: string[] = [];
              const listResponse = await fetch("/api/towkay/users");
              if (!listResponse.ok) throw new Error(`List users failed: ${listResponse.status}`);
              const users = await listResponse.json() as Array<{ id: string; username: string }>;
              for (
                const user of users.filter((candidate) => usernames.includes(candidate.username))
              ) {
                try {
                  const response = await fetch("/api/towkay/users/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.id, confirmed: true }),
                  });
                  if (!response.ok) {
                    errors.push(`Delete ${user.username} failed: HTTP ${response.status}`);
                  }
                } catch (error) {
                  errors.push(`Delete ${user.username} failed: ${String(error)}`);
                }
              }
              const verifyResponse = await fetch("/api/towkay/users");
              const verified = await verifyResponse.json() as Array<{ username: string }>;
              return {
                errors,
                remaining: verified.filter((candidate) => usernames.includes(candidate.username)),
              };
            }, createdUsernames);
            if (cleanupResult.errors.length > 0 || cleanupResult.remaining.length > 0) {
              cleanupFailure = new Error(
                [
                  ...cleanupResult.errors,
                  cleanupResult.remaining.length > 0
                    ? `E2E users leaked: ${
                      cleanupResult.remaining.map((user) => user.username).join(", ")
                    }`
                    : "",
                ].filter(Boolean).join("; "),
              );
            }
          } catch (error) {
            cleanupFailure = error;
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "Admin users behavior and cleanup both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { acceptDialogs: true, successScreenshot: "admin-users" },
    );
  },
});
