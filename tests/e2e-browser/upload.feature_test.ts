import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

Deno.test({
  name: "Feature 1: Upload Page",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    try {
      await page.goto(getBaseUrl() + "/muatnaik");
      await page.waitForSelector("form");
      const body = await page.textContent("body") ?? "";
      const hasContent = body.includes("Share your moment") || body.includes("upload") ||
        body.includes("muatnaik");
      assertEquals(hasContent, true, "Upload page should have content");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
