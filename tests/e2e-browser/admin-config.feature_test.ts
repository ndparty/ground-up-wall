import { chromium, type Page } from "playwright";
import { assertEquals, assertGreater } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

type SystemConfigRow = {
  key: string;
  value: string;
  default_value: string;
};

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(getBaseUrl() + "/masuk");
  await page.fill('input[name="username"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(semak|towkay)/, { timeout: 10_000 });
}

async function assertRedirectsToLogin(page: Page, path: string, story: string): Promise<void> {
  await page.goto(getBaseUrl() + path);
  await page.waitForURL(/\/masuk/);
  const body = await page.textContent("body") ?? "";
  assertEquals(
    body.includes("Masuk") || body.includes("Login") || body.includes("username"),
    true,
    `${story}: unauthenticated access redirects to login`,
  );
}

async function fetchSystemConfig(page: Page, key: string): Promise<SystemConfigRow> {
  return await page.evaluate(async (configKey) => {
    const res = await fetch("/api/towkay/parameters");
    const data = await res.json() as SystemConfigRow[];
    const config = data.find((row) => row.key === configKey);
    if (!config) throw new Error(`Missing system config: ${configKey}`);
    return config;
  }, key);
}

function configPanel(page: Page, label: string) {
  return page.locator(".panel--form", { has: page.locator("strong", { hasText: label }) });
}

async function saveParameter(page: Page, label: string): Promise<void> {
  await configPanel(page, label).locator("button", { hasText: "Save" }).click();
}

async function resetParameter(page: Page, label: string): Promise<void> {
  await configPanel(page, label).locator("button", { hasText: "Reset to default" }).click();
}

async function waitForConfigValue(page: Page, key: string, value: string): Promise<void> {
  await page.waitForFunction(
    async ([configKey, expectedValue]) => {
      const res = await fetch("/api/towkay/parameters");
      const data = await res.json() as SystemConfigRow[];
      return data.find((row) => row.key === configKey)?.value === expectedValue;
    },
    [key, value],
    { timeout: 10_000 },
  );
}

Deno.test({
  name: "Feature 4: Admin Config (US-14, US-17, US-19)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("dialog", (dialog) => dialog.accept());

    try {
      await assertRedirectsToLogin(page, "/towkay/parameters", "US-14");
      await assertRedirectsToLogin(page, "/towkay/audit-log", "US-17");
      await assertRedirectsToLogin(page, "/towkay/display-override", "US-19");

      await loginAsAdmin(page);

      await page.goto(getBaseUrl() + "/towkay/parameters");
      await page.waitForSelector(".param-section", { timeout: 10_000 });

      const dwellTimeInput = page.locator('input[aria-label="Train dwell time (seconds)"]');
      await dwellTimeInput.fill("10");
      await saveParameter(page, "Train dwell time (seconds)");
      await waitForConfigValue(page, "train_dwell_time", "10");
      await page.reload();
      await page.waitForSelector(".param-section", { timeout: 10_000 });
      await page.waitForFunction(
        () =>
          (document.querySelector(
            'input[aria-label="Train dwell time (seconds)"]',
          ) as HTMLInputElement | null)?.value === "10",
        { timeout: 10_000 },
      );
      assertEquals(
        await page.locator('input[aria-label="Train dwell time (seconds)"]').inputValue(),
        "10",
        "US-14: train dwell time persists after save",
      );

      const promptText = `What do you love about Singapore? ${Date.now()}`;
      await page.locator('input[aria-label="Upload message prompt"]').fill(promptText);
      await saveParameter(page, "Upload message prompt");
      await waitForConfigValue(page, "message_prompt_text", promptText);

      await page.locator('textarea[aria-label="Auto-moderator word list"]').fill(
        "badword1\nbadword2\nbadword3",
      );
      await saveParameter(page, "Auto-moderator word list");
      await page.waitForFunction(async () => {
        const res = await fetch("/api/towkay/parameters");
        const data = await res.json() as SystemConfigRow[];
        return data.find((row) => row.key === "auto_moderator_word_list")?.value.includes(
          "badword1",
        );
      });

      await page.locator('input[aria-label="Message length limit"]').fill("10");
      await saveParameter(page, "Message length limit");
      await waitForConfigValue(page, "message_length_limit", "10");
      await page.locator('select[aria-label="Message length unit"]').selectOption("words");
      await saveParameter(page, "Message length unit");
      await waitForConfigValue(page, "message_length_unit", "words");

      await resetParameter(page, "Train dwell time (seconds)");
      const resetDwellTime = await fetchSystemConfig(page, "train_dwell_time");
      assertEquals(
        resetDwellTime.value,
        resetDwellTime.default_value,
        "US-14: reset restores train dwell time to its default",
      );
      await page.waitForFunction(
        (expectedValue) =>
          (document.querySelector(
            'input[aria-label="Train dwell time (seconds)"]',
          ) as HTMLInputElement | null)?.value === expectedValue,
        resetDwellTime.value,
        { timeout: 10_000 },
      );

      const resetDwellTimeInput = page.locator('input[aria-label="Train dwell time (seconds)"]');
      await resetDwellTimeInput.click();
      await page.keyboard.press("Meta+A");
      await page.keyboard.press("Backspace");
      await page.keyboard.type("0");
      assertEquals(
        await resetDwellTimeInput.inputValue(),
        "0",
        "US-14: invalid dwell time is entered before saving",
      );
      const validationResponsePromise = page.waitForResponse((res) =>
        res.url().endsWith("/api/towkay/parameters/update") &&
        res.request().method() === "POST"
      );
      await saveParameter(page, "Train dwell time (seconds)");
      const validationResponse = await validationResponsePromise;
      assertEquals(validationResponse.status(), 400, "US-14: invalid dwell time is rejected");
      const validationBody = await validationResponse.json() as { error?: string };
      assertEquals(
        validationBody.error,
        "train_dwell_time must be an integer between 3 and 60",
        "US-14: invalid dwell time returns a validation error",
      );

      await page.goto(getBaseUrl() + "/towkay/audit-log");
      await page.waitForSelector(".filter-bar", { timeout: 10_000 });
      await page.locator('select[aria-label="Filter by action type"]').selectOption(
        "change_config",
      );
      await page.locator('select[aria-label="Filter by target type"]').selectOption(
        "system_config",
      );
      await page.locator('button:has-text("Apply filters")').click();
      await page.locator(".data-table__row", { hasText: "train_dwell_time" }).first().waitFor({
        state: "visible",
        timeout: 10_000,
      });

      const tableHeaders = await page.locator(".data-table__head th").allTextContents();
      assertGreater(tableHeaders.length, 0, "US-17: audit log table has headers");
      assertEquals(
        tableHeaders.some((header) => header.includes("Timestamp")) &&
          tableHeaders.some((header) => header.includes("Moderator")) &&
          tableHeaders.some((header) => header.includes("Action")),
        true,
        "US-17: audit log shows timestamp, moderator, and action columns",
      );
      assertEquals(
        await page.locator(".data-table__row", { hasText: "change_config" }).count() > 0,
        true,
        "US-17: action filter shows configuration changes",
      );
      assertEquals(
        await page.locator('button:has-text("Edit"), button:has-text("Delete")').count(),
        0,
        "US-17: audit log is read-only",
      );

      await page.goto(getBaseUrl() + "/towkay/display-override");
      await page.waitForSelector("section.panel", { timeout: 10_000 });

      await page.locator('button:has-text("Blank screen")').click();
      await page.locator("section.panel strong", { hasText: "Blank" }).waitFor({
        state: "visible",
        timeout: 10_000,
      });

      await page.locator('button:has-text("Show placeholder")').click();
      await page.locator("section.panel strong", { hasText: "Placeholder" }).waitFor({
        state: "visible",
        timeout: 10_000,
      });

      await page.locator('button:has-text("Resume display")').click();
      await page.locator("section.panel strong", { hasText: "Normal" }).waitFor({
        state: "visible",
        timeout: 10_000,
      });
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
