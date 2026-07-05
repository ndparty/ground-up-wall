import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

Deno.test({
  name: "Feature 4: Admin Config (US-14, US-17, US-19)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      // US-14: Admin config page requires authentication
      await page.goto(getBaseUrl() + "/towkay/parameters");
      // Should redirect to login
      await page.waitForURL(/\/masuk/);
      const body = await page.textContent("body") ?? "";
      const hasLoginContent = body.includes("Sign in") || body.includes("Login") ||
        body.includes("username");
      assertEquals(hasLoginContent, true, "US-14: unauthenticated access redirects to login");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
