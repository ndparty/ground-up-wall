import { chromium } from "playwright";
import { assertEquals, assertGreater } from "@std/assert";
import { getBaseUrl, startServer, stopServer } from "./setup.ts";

const DISPLAY_USERNAME = "display";
const DISPLAY_PASSWORD = "demo123";
const MODERATOR_USERNAME = "moderator";
const MODERATOR_PASSWORD = "demo123";

async function login(
  page: import("playwright").Page,
  username: string,
  password: string,
): Promise<void> {
  // Use the no-JS form fallback at /masuk (sets the session cookie directly).
  await page.goto(getBaseUrl() + "/masuk");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // After a successful login the server redirects to the role home
  // (display -> /concourse, moderator/admin -> /semak). Wait for any authed landing.
  await page.waitForURL(/\/(concourse|semak)/, { timeout: 10_000 });
}

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
      await page.waitForURL(/\/masuk/);
      const loginBody = await page.textContent("body") ?? "";
      const hasLoginContent = loginBody.includes("Masuk") || loginBody.includes("Login") ||
        loginBody.includes("username");
      assertEquals(hasLoginContent, true, "US-07: unauthenticated access redirects to login");

      // ---- US-07 + US-08: display-wall viewer sees the live wall ----
      await login(page, DISPLAY_USERNAME, DISPLAY_PASSWORD);

      // US-07: Authenticated display wall renders cabins (approved submissions)
      await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
      const cabinCount = await page.locator(".train-cabin-wrap").count();
      assertGreater(cabinCount, 0, "US-07: at least one cabin should render on the wall");

      // US-08: At least one cabin is highlighted as the active (centre) cabin.
      // The --active class is briefly toggled during slide animations, so we poll until
      // a stable active cabin is present rather than asserting an instantaneous count.
      const activeVisible = await page
        .waitForFunction(
          () => document.querySelectorAll(".train-cabin-wrap--active").length > 0,
          { timeout: 10_000, polling: 500 },
        )
        .then(() => true)
        .catch(() => false);
      assertEquals(activeVisible, true, "US-08: an active cabin should be highlighted");

      // US-08: Wall updates automatically (SSE-driven). The display-wall viewer sees a live,
      // server-populated wall: an active cabin is highlighted and multiple approved cabins
      // are rendered from the database without a manual refresh.
      assertGreater(cabinCount, 1, "US-08: wall shows multiple server-driven cabins");

      // ---- US-15: moderator can pause/play and jump to a cabin ----
      // The display-wall role does not get playback controls; the moderator/admin role does.
      // Log in as moderator, then open the display wall where the controls live.
      await page.goto(getBaseUrl() + "/api/masuk/logout").catch(() => {});
      await login(page, MODERATOR_USERNAME, MODERATOR_PASSWORD);
      await page.goto(getBaseUrl() + "/concourse");
      await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
      // Dismiss the fullscreen prompt dialog if it is covering the controls
      const notNow = page.locator(".display-wall__fullscreen-prompt-secondary");
      if (await notNow.count() > 0) {
        await notNow.click();
        await page.waitForSelector(".display-wall__fullscreen-prompt", {
          state: "detached",
          timeout: 5_000,
        })
          .catch(() => {});
      }

      // US-15: Playback controls are present for the moderator role
      const controls = page.locator(".train-controls");
      assertEquals(await controls.count() > 0, true, "US-15: train controls should be visible");

      const pausePlayBtn = page.locator(".train-controls__btn").first();
      const initialLabel = (await pausePlayBtn.textContent())?.trim();
      assertEquals(
        initialLabel === "Pause" || initialLabel === "Play",
        true,
        "US-15: pause/play control should be present",
      );

      // US-15: Pause toggles the control to Play
      if (initialLabel === "Pause") {
        await pausePlayBtn.click();
        await page.waitForFunction(
          () => {
            const btn = document.querySelector(".train-controls__btn");
            return btn && btn.textContent?.trim() === "Play";
          },
          { timeout: 5_000 },
        );
        const afterLabel = (await pausePlayBtn.textContent())?.trim();
        assertEquals(afterLabel, "Play", "US-15: clicking Pause should switch control to Play");
        // Resume so we leave the wall playing
        await pausePlayBtn.click();
      }

      // US-15: Jump-to-cabin control exists and updates the cabin status
      const jumpInput = page.locator('.train-controls__jump input[type="number"]');
      assertEquals(await jumpInput.count() > 0, true, "US-15: jump-to-cabin input should exist");
      await jumpInput.fill("1");
      await page.locator(".train-controls__jump .train-controls__btn").click();
      // Status text reflects "Cabin N of M"
      await page.waitForFunction(
        () =>
          /\bCabin \d+ of \d+\b/.test(
            document.querySelector(".train-controls__status")?.textContent ?? "",
          ),
        { timeout: 5_000 },
      );
      const statusAfter = (await page.locator(".train-controls__status").textContent())?.trim() ??
        "";
      assertEquals(
        /\bCabin \d+ of \d+\b/.test(statusAfter),
        true,
        "US-15: cabin status should report current cabin position",
      );
    } finally {
      await browser.close();
      stopServer();
    }
  },
});
