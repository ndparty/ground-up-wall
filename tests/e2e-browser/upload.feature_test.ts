import { chromium } from "playwright";
import { assertEquals } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

Deno.test({
  name: "Feature 1: Upload Page - US-01, US-02, US-02a",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    try {
      // US-02: Access via short URL - page loads without login
      await page.goto(getBaseUrl() + "/muatnaik");
      await page.waitForSelector("form");

      // US-02a: Privacy notice displayed
      const privacyNotice = await page.textContent(".upload-privacy-notice__list");
      assertEquals(
        privacyNotice?.includes("photowall") || privacyNotice?.includes("event"),
        true,
        "US-02a: Privacy notice should be displayed",
      );

      // US-02a: Acknowledgment checkbox exists (data-field is on parent div)
      const checkbox = await page.$('div[data-field="acknowledged"] input[type="checkbox"]');
      assertEquals(checkbox !== null, true, "US-02a: Acknowledgment checkbox should exist");

      // US-01: Form elements exist
      const photoInput = await page.$('input[type="file"][accept*="image"]');
      const messageInput = await page.$("textarea[placeholder]");
      const nameInput = await page.$('label[data-field="submitter_name"] input');
      const submitButton = await page.$('button[type="submit"]');

      assertEquals(photoInput !== null, true, "US-01: Photo input should exist");
      assertEquals(messageInput !== null, true, "US-01: Message input should exist");
      assertEquals(nameInput !== null, true, "US-01: Name input should exist");
      assertEquals(submitButton !== null, true, "US-01: Submit button should exist");

      // US-01: Submit button is enabled (validation happens on submit, not button state)
      // The button is only disabled during loading state
      const isDisabled = await submitButton?.isDisabled();
      assertEquals(isDisabled, false, "US-01: Submit button should be enabled initially");
    } finally {
      await browser.close();
      stopServer();
    }
  },
});

Deno.test({
  name: "Feature 1: Upload Validation - US-01",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    try {
      await page.goto(getBaseUrl() + "/muatnaik");
      await page.waitForSelector("form");

      // US-01: No file selected - validation error on submit
      const submitButton = await page.$('button[type="submit"]');
      await submitButton?.click();

      // Wait for error message
      await page.waitForSelector(".upload-field-error", { timeout: 2000 });
      const errorText = await page.textContent(".upload-field-error");
      assertEquals(
        errorText?.includes("photo") || errorText?.includes("select"),
        true,
        "US-01: Should show validation error for no photo",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
