import { Buffer } from "node:buffer";
import { assertEquals } from "@std/assert";
import { testJpegBlob } from "../../lib/image/test_jpeg.ts";
import { moderateFixture, submitFixtureRequest } from "./fixtures.ts";
import { captureVisualBaseline, getBaseUrl, loginAsAdmin, runBrowserTest } from "./helpers.ts";

Deno.test({
  name: "Feature 1: Upload Page - US-01, US-02, US-02a",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 1: Upload Page - US-01, US-02, US-02a",
      async ({ page }) => {
        await page.goto(getBaseUrl() + "/muatnaik");
        await page.waitForSelector("form");

        const privacyNotice = await page.textContent(".upload-privacy-notice__list");
        assertEquals(
          privacyNotice?.includes("photowall") || privacyNotice?.includes("event"),
          true,
          "US-02a: Privacy notice should be displayed",
        );

        const checkbox = await page.$('div[data-field="acknowledged"] input[type="checkbox"]');
        assertEquals(checkbox !== null, true, "US-02a: Acknowledgment checkbox should exist");

        const photoInput = await page.$('input[type="file"][accept*="image"]');
        const messageInput = await page.$("textarea[placeholder]");
        const nameInput = await page.$('label[data-field="submitter_name"] input');
        const submitButton = await page.$('button[type="submit"]');

        assertEquals(photoInput !== null, true, "US-01: Photo input should exist");
        assertEquals(messageInput !== null, true, "US-01: Message input should exist");
        assertEquals(nameInput !== null, true, "US-01: Name input should exist");
        assertEquals(submitButton !== null, true, "US-01: Submit button should exist");

        const isDisabled = await submitButton?.isDisabled();
        assertEquals(isDisabled, false, "US-01: Submit button should be enabled initially");
      },
      {
        viewport: { width: 375, height: 812 },
        successScreenshot: "upload-form",
        visualBaseline: "upload-form",
      },
    );
  },
});

Deno.test({
  name: "Feature 1: Upload Validation - US-01",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 1: Upload Validation - US-01",
      async ({ page }) => {
        const uniqueName = "E2E Upload Fixture";
        const uploadRequests: string[] = [];
        let fixtureId: string | null = null;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        page.on("request", (request) => {
          if (request.url().endsWith("/api/muatnaik/submit")) uploadRequests.push(request.url());
        });
        try {
          await page.goto(getBaseUrl() + "/muatnaik");
          await page.waitForSelector("form");
          const serverRejection = await submitFixtureRequest(page, {
            name: uniqueName,
            message: "Server must reject this unacknowledged upload",
            acknowledged: false,
          });
          assertEquals(
            serverRejection.status,
            400,
            "US-02a: server independently rejects an unacknowledged upload",
          );
          const photo = Buffer.from(await testJpegBlob().arrayBuffer());
          await page.locator('input[type="file"]').setInputFiles({
            name: "e2e-upload.jpg",
            mimeType: "image/jpeg",
            buffer: photo,
          });
          await page.locator("textarea").fill("A deterministic E2E upload");
          await page.locator('label[data-field="submitter_name"] input').fill(uniqueName);
          await page.locator(".upload-photo-selected").waitFor({ state: "visible" });

          const requestsBeforeUiSubmit = uploadRequests.length;
          await page.locator('button[type="submit"]').click();
          const acknowledgmentError = page.locator(
            'div[data-field="acknowledged"] .upload-field-error',
          );
          await acknowledgmentError.waitFor({ state: "visible", timeout: 2_000 });
          const errorText = await acknowledgmentError.textContent();
          assertEquals(
            errorText?.includes("acknowledge"),
            true,
            "US-02a: otherwise-valid submission is rejected until privacy is acknowledged",
          );
          assertEquals(
            uploadRequests.length,
            requestsBeforeUiSubmit,
            "US-02a: client validation prevents an unacknowledged request",
          );
          await captureVisualBaseline(page, "upload-acknowledgment-error-static", {
            mask: [".station-sign"],
          });

          await page.locator('div[data-field="acknowledged"] input[type="checkbox"]').check();
          const uploadResponsePromise = page.waitForResponse((response) =>
            response.url().endsWith("/api/muatnaik/submit") && response.status() === 201
          );
          await page.locator('button[type="submit"]').click();
          const uploadResponse = await uploadResponsePromise;
          const uploadBody = await uploadResponse.json() as { submission_id: string };
          fixtureId = uploadBody.submission_id;
          await page.locator(".upload-success").waitFor({ state: "visible", timeout: 20_000 });
          assertEquals(
            (await page.locator(".upload-success").textContent())?.includes(
              "waiting for moderation",
            ),
            true,
            "US-01: a valid acknowledged upload reaches confirmation",
          );
          await captureVisualBaseline(page, "upload-success-static");

          await loginAsAdmin(page);
          await page.goto(getBaseUrl() + "/semak");
          const submittedCard = page.locator(
            `.submission-card[data-submission-id="${fixtureId}"]`,
          );
          await submittedCard.waitFor({ state: "visible", timeout: 15_000 });
          assertEquals(
            await submittedCard.count() > 0,
            true,
            "US-01: successful upload appears in the moderation queue",
          );
        } catch (error) {
          testFailure = error;
        } finally {
          if (fixtureId) {
            try {
              if (!page.url().includes("/semak")) {
                await loginAsAdmin(page);
              }
              await moderateFixture(page, "delete", fixtureId);
            } catch (error) {
              cleanupFailure = error;
            }
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "Upload behavior and fixture cleanup both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { viewport: { width: 375, height: 812 }, acceptDialogs: true },
    );
  },
});
