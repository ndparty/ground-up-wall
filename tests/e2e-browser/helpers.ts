/**
 * Shared Playwright helpers for browser E2E tests.
 * Login fails hard (waitForURL) — never soft-pass when still on /masuk.
 */

import type { Page } from "playwright";
import { assertEquals } from "@std/assert";
import { getBaseUrl } from "./setup.ts";

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
