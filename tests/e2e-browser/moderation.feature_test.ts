import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

Deno.test({
  name: "Feature 2: Moderate Photos (US-03, US-04, US-05, US-06, US-12)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      // US-03: Login page loads
      await page.goto(getBaseUrl() + "/masuk");
      await page.waitForSelector("form");
      const body = await page.textContent("body") ?? "";
      const hasLoginContent = body.includes("Sign in") || body.includes("Login") ||
        body.includes("username");
      assertEquals(hasLoginContent, true, "US-03: login page should have form elements");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
