import { type BrowserContext, type Page } from "playwright";
import { assertEquals, assertGreater } from "@std/assert";
import { formatWordListForEdit } from "../../lib/admin/parameter_validation.ts";
import { captureAnimationBoundaries, compareAnimationBoundarySequence } from "./animation.ts";
import {
  assertRedirectsToLogin,
  captureVisualBaseline,
  getBaseUrl,
  loginAsAdmin,
  runBrowserTest,
} from "./helpers.ts";
import { visualComparisonsEnabled } from "./visual.ts";

type SystemConfigRow = {
  key: string;
  value: string;
  default_value: string;
};

const MUTATED_KEYS = [
  "train_dwell_time",
  "message_prompt_text",
  "auto_moderator_word_list",
  "message_length_limit",
  "message_length_unit",
] as const;

async function fetchSystemConfig(page: Page, key: string): Promise<SystemConfigRow> {
  return await page.evaluate(async (configKey) => {
    const res = await fetch("/api/towkay/parameters");
    const data = await res.json() as SystemConfigRow[];
    const config = data.find((row) => row.key === configKey);
    if (!config) throw new Error(`Missing system config: ${configKey}`);
    return config;
  }, key);
}

async function snapshotConfigs(
  page: Page,
  keys: readonly string[],
): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const key of keys) {
    snapshot[key] = (await fetchSystemConfig(page, key)).value;
  }
  return snapshot;
}

async function restoreConfigs(page: Page, snapshot: Record<string, string>): Promise<void> {
  const errors: unknown[] = [];
  for (const [key, value] of Object.entries(snapshot)) {
    try {
      const restoreValue = key === "auto_moderator_word_list"
        ? formatWordListForEdit(value)
        : value;
      const res = await page.evaluate(async ([configKey, configValue]) => {
        const response = await fetch("/api/towkay/parameters/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: configKey, value: configValue }),
        });
        return { ok: response.ok, status: response.status };
      }, [key, restoreValue] as [string, string]);
      if (!res.ok) {
        throw new Error(`Failed to restore ${key}: HTTP ${res.status}`);
      }
      const restored = await fetchSystemConfig(page, key);
      if (restored.value !== value) {
        throw new Error(
          `Failed to verify restored ${key}: expected ${JSON.stringify(value)}, got ${
            JSON.stringify(restored.value)
          }`,
        );
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "One or more system configurations failed to restore");
  }
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

async function restoreNormalDisplay(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append("type", "resume");
    const response = await fetch("/api/towkay/display-override", { method: "POST", body: form });
    if (!response.ok) return { ok: false, status: response.status, type: "" };
    const stateResponse = await fetch("/api/towkay/display-override");
    const state = await stateResponse.json() as { type?: string };
    return {
      ok: stateResponse.ok && state.type === "normal",
      status: stateResponse.status,
      type: state.type,
    };
  });
  if (!result.ok) {
    throw new Error(
      `Failed to restore normal display override: HTTP ${result.status}, type=${result.type}`,
    );
  }
}

async function assertOverrideAuditActions(page: Page): Promise<void> {
  const actions = await page.evaluate(async () => {
    const response = await fetch(
      "/api/towkay/audit-log?target_type=display_override&limit=200",
    );
    const body = await response.json() as { entries: Array<{ action_type: string }> };
    return body.entries.map((entry) => entry.action_type);
  });
  for (const expected of ["blank_display", "show_placeholder", "resume_display"]) {
    assertEquals(actions.includes(expected), true, `US-19: audit log records ${expected}`);
  }
}

Deno.test({
  name: "Feature 4: Admin Config (US-14, US-17, US-19)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 4: Admin Config (US-14, US-17, US-19)",
      async ({ page, browser }) => {
        let configSnapshot: Record<string, string> | null = null;
        let displayContext: BrowserContext | null = null;
        let displayPage: Page | null = null;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          await assertRedirectsToLogin(page, "/towkay/parameters", "US-14");
          await assertRedirectsToLogin(page, "/towkay/audit-log", "US-17");
          await assertRedirectsToLogin(page, "/towkay/display-override", "US-19");

          await loginAsAdmin(page);
          await restoreNormalDisplay(page);
          displayContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
          displayPage = await displayContext.newPage();
          await loginAsAdmin(displayPage);
          await displayPage.goto(getBaseUrl() + "/concourse");
          await displayPage.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
          const dismissFullscreen = displayPage.locator(
            ".display-wall__fullscreen-prompt-secondary",
          );
          if (await dismissFullscreen.count() > 0) await dismissFullscreen.click();

          await page.goto(getBaseUrl() + "/towkay/parameters");
          await page.waitForSelector(".param-section, .text-muted", { timeout: 10_000 });

          configSnapshot = await snapshotConfigs(page, MUTATED_KEYS);
          await captureVisualBaseline(page, "admin-parameters-static", {
            mask: [
              '.panel--form:has([aria-label="display_override_state"])',
              '.panel--form:has([aria-label="train_playback_state"])',
            ],
          });

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

          const resetDwellTimeInput = page.locator(
            'input[aria-label="Train dwell time (seconds)"]',
          );
          await resetDwellTimeInput.fill("0");
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
          await captureVisualBaseline(page, "admin-audit-filtered-static", {
            mask: [
              ".pagination-bar",
              ".data-table__row td:first-child",
              ".data-table__row td:nth-child(5)",
              ".data-table__row td:nth-child(6)",
            ],
          });

          await page.goto(getBaseUrl() + "/towkay/display-override");
          await page.waitForSelector("section.panel", { timeout: 10_000 });

          await page.locator('button:has-text("Blank screen")').click();
          if (visualComparisonsEnabled()) {
            await displayPage.waitForFunction(() =>
              document.querySelector(".display-wall__override-layer")?.getAnimations().some(
                (animation) => (animation as CSSTransition).transitionProperty === "opacity",
              )
            );
            const fadeIn = await captureAnimationBoundaries(displayPage, {
              animationSelector: ".display-wall__override-layer",
              captureSelector: ".display-wall",
              transitionProperty: "opacity",
            });
            await compareAnimationBoundarySequence(
              "display-override-fade-in",
              ".display-wall__override-layer",
              fadeIn,
            );
          }
          await page.locator("section.panel strong", { hasText: "Blank" }).waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await displayPage.locator(
            ".display-wall__override-layer--visible .display-wall__override-blank",
          ).waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await captureVisualBaseline(displayPage, "admin-override-blank-static");

          await page.locator('button:has-text("Show placeholder")').click();
          if (visualComparisonsEnabled()) {
            await displayPage.waitForFunction(() =>
              document.querySelector(".display-wall__override-panel--over")?.getAnimations().some(
                (animation) =>
                  (animation as CSSAnimation).animationName === "display-wall-override-in",
              )
            );
            const crossfade = await captureAnimationBoundaries(displayPage, {
              animationSelector: ".display-wall__override-panel--over",
              captureSelector: ".display-wall",
              animationName: "display-wall-override-in",
            });
            await compareAnimationBoundarySequence(
              "display-override-crossfade",
              ".display-wall__override-panel--over",
              crossfade,
            );
          }
          await page.locator("section.panel strong", { hasText: "Placeholder" }).waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await displayPage.locator(
            ".display-wall__override-layer--visible .display-wall__override-placeholder, " +
              ".display-wall__override-layer--visible .display-wall__empty",
          ).waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await captureVisualBaseline(displayPage, "admin-override-placeholder-static");

          await page.locator('button:has-text("Resume display")').click();
          if (visualComparisonsEnabled()) {
            await displayPage.waitForFunction(() =>
              document.querySelector(".display-wall__override-layer")?.getAnimations().some(
                (animation) => (animation as CSSTransition).transitionProperty === "opacity",
              )
            );
            const fadeOut = await captureAnimationBoundaries(displayPage, {
              animationSelector: ".display-wall__override-layer",
              captureSelector: ".display-wall",
              transitionProperty: "opacity",
            });
            await compareAnimationBoundarySequence(
              "display-override-fade-out",
              ".display-wall__override-layer",
              fadeOut,
            );
          }
          await page.locator("section.panel strong", { hasText: "Normal" }).waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await displayPage.locator(".display-wall__override-panel").waitFor({
            state: "detached",
            timeout: 10_000,
          });
          await displayPage.locator(".train-cabin-wrap--active").waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await captureVisualBaseline(displayPage, "admin-override-normal-static", {
            mask: [".display-wall__join-text"],
          });
          if (visualComparisonsEnabled()) {
            await displayPage.evaluate(() => {
              document.getElementById("e2e-sparkle-source")?.remove();
              const fixture = document.createElement("div");
              fixture.id = "e2e-sparkle-source";
              fixture.className = "display-wall";
              fixture.innerHTML =
                '<div class="display-wall__empty"><div class="display-wall__sparkles"></div>' +
                '<p class="display-wall__empty-title">Submissions coming soon!</p></div>';
              document.body.append(fixture);
            });
            const sparkle = await captureAnimationBoundaries(displayPage, {
              animationSelector: "#e2e-sparkle-source .display-wall__sparkles",
              captureSelector: "#e2e-sparkle-source",
              animationName: "display-wall-twinkle",
            });
            await compareAnimationBoundarySequence(
              "display-wall-sparkle",
              ".display-wall__sparkles",
              sparkle,
            );
            await displayPage.evaluate(() =>
              document.getElementById("e2e-sparkle-source")?.remove()
            );
          }
          await assertOverrideAuditActions(page);
        } catch (error) {
          testFailure = error;
        } finally {
          try {
            await restoreNormalDisplay(page);
          } catch (error) {
            cleanupFailure = error;
          }
          if (displayPage && !displayPage.isClosed()) {
            try {
              await displayPage.close();
            } catch (error) {
              cleanupFailure = cleanupFailure === null ? error : new AggregateError(
                [cleanupFailure, error],
                "Display override and display-page cleanup both failed",
              );
            }
          }
          if (displayContext) {
            try {
              await displayContext.close();
            } catch (error) {
              cleanupFailure = cleanupFailure === null ? error : new AggregateError(
                [cleanupFailure, error],
                "Display context and prior cleanup both failed",
              );
            }
          }
          if (configSnapshot) {
            try {
              await restoreConfigs(page, configSnapshot);
            } catch (error) {
              cleanupFailure = cleanupFailure === null ? error : new AggregateError(
                [cleanupFailure, error],
                "Admin config resource and configuration cleanup both failed",
              );
            }
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "Admin config test and shared-state restoration both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { acceptDialogs: true, successScreenshot: "admin-config" },
    );
  },
});
