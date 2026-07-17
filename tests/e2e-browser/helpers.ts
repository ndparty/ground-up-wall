/**
 * Shared Playwright helpers for browser E2E tests.
 * Login fails hard (waitForURL) — never soft-pass when still on /masuk.
 */

import { type Browser, chromium, type Page } from "playwright";
import { assertEquals } from "@std/assert";
import { attachConsole, captureFailure, captureSuccess, recordPass } from "./artifacts.ts";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";
import { compareScreenshot, type VisualCompareOptions } from "./visual.ts";

export { getBaseUrl };

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = Deno.env.get("ADMIN_INITIAL_PASSWORD") || "admin123";

export const DISPLAY_USERNAME = "display";
export const DISPLAY_PASSWORD = Deno.env.get("DEMO_DISPLAY_PASSWORD") || "demo123";

export const MODERATOR_USERNAME = "moderator";
export const MODERATOR_PASSWORD = Deno.env.get("DEMO_MODERATOR_PASSWORD") || "demo123";

/** Dedicated seeded account for US-11 password mutation — do not reuse admin/moderator. */
export const PWDCHANGE_USERNAME = "pwdchange";
export const PWDCHANGE_PASSWORD = Deno.env.get("DEMO_PWDCHANGE_PASSWORD") || "PwdChange1!ab";

/** Authed landing paths after /masuk (role-dependent). */
const AUTHED_URL = /\/(concourse|semak|towkay)/;

export type BrowserTestContext = {
  page: Page;
  browser: Browser;
};

export type RunBrowserTestOptions = {
  viewport?: { width: number; height: number };
  acceptDialogs?: boolean;
  /** Writes success/<name>.png when E2E_CAPTURE_SUCCESS_SHOT=1 */
  successScreenshot?: string;
  /** Compares the settled page against tests/e2e-browser/baselines/<name>.png. */
  visualBaseline?: string;
};

/**
 * Start Fresh + Chromium, run the body, capture failure/success artifacts, always teardown.
 */
export async function runBrowserTest(
  name: string,
  fn: (ctx: BrowserTestContext) => Promise<void>,
  opts: RunBrowserTestOptions = {},
): Promise<void> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let failure: unknown = null;
  let consoleLines: string[] = [];
  try {
    await startServer();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({
      viewport: opts.viewport ?? { width: 1280, height: 800 },
    });
    consoleLines = attachConsole(page);
    if (opts.acceptDialogs) {
      page.on("dialog", (dialog) => dialog.accept());
    }
    await fn({ page, browser });
    if (opts.visualBaseline) {
      await compareScreenshot(page, opts.visualBaseline);
    }
    if (opts.successScreenshot) {
      await captureSuccess(page, opts.successScreenshot);
    }
  } catch (err) {
    failure = err;
    try {
      await captureFailure(page, name, err, consoleLines);
    } catch (artifactError) {
      failure = new AggregateError(
        [err, artifactError],
        `${name} failed and its failure artifact could not be captured`,
      );
    }
  } finally {
    const cleanupErrors: unknown[] = [];
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await stopServer();
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length > 0) {
      failure = new AggregateError(
        failure === null ? cleanupErrors : [failure, ...cleanupErrors],
        `${name} cleanup failed`,
      );
      try {
        await captureFailure(null, name, failure, consoleLines);
      } catch (artifactError) {
        failure = new AggregateError(
          [failure, artifactError],
          `${name} cleanup failed and its failure artifact could not be updated`,
        );
      }
    }
  }
  if (failure !== null) throw failure;
  await recordPass(name);
}

export async function loginAs(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto(getBaseUrl() + "/masuk");
  await page.waitForSelector('input[name="username"]');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(AUTHED_URL, { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, ADMIN_USERNAME, ADMIN_PASSWORD);
}

export async function waitForTrackIdle(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForSelector(
    '.display-wall__track[data-e2e-track-state="idle"]',
    { timeout },
  );
}

export async function waitForTrackSliding(page: Page, timeout = 5_000): Promise<void> {
  await page.waitForSelector(
    '.display-wall__track[data-e2e-track-state="sliding"]',
    { timeout },
  );
}

export async function captureVisualBaseline(
  page: Page,
  name: string,
  options: VisualCompareOptions = {},
): Promise<void> {
  await compareScreenshot(page, name, options);
}

export async function assertRedirectsToLogin(
  page: Page,
  path: string,
  story: string,
): Promise<void> {
  await page.goto(getBaseUrl() + path);
  await page.waitForURL(/\/masuk/);
  const body = await page.textContent("body") ?? "";
  assertEquals(
    body.includes("Masuk") || body.includes("Login") || body.includes("username"),
    true,
    `${story}: unauthenticated access redirects to login`,
  );
}
