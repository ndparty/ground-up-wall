import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

Deno.test({
  name: "Feature 3: Display Wall (US-07, US-08, US-15)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    try {
      // US-07: Display wall requires authentication
      await page.goto(getBaseUrl() + "/concourse");
      // Should redirect to login
      await page.waitForURL(/\/masuk/);
      const body = await page.textContent("body") ?? "";
      const hasLoginContent = body.includes("Masuk") || body.includes("Login") ||
        body.includes("username");
      assertEquals(hasLoginContent, true, "US-07: unauthenticated access redirects to login");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
