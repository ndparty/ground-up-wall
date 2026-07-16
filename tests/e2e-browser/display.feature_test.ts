import { assertEquals, assertGreater } from "@std/assert";
import {
  DISPLAY_PASSWORD,
  DISPLAY_USERNAME,
  getBaseUrl,
  loginAs,
  MODERATOR_PASSWORD,
  MODERATOR_USERNAME,
  runBrowserTest,
  waitForTrackIdle,
  waitForTrackSliding,
} from "./helpers.ts";

Deno.test({
  name: "Feature 3: Display Wall (US-07, US-08, US-15)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 3: Display Wall (US-07, US-08, US-15)",
      async ({ page }) => {
        await page.goto(getBaseUrl() + "/concourse");
        await page.waitForURL(/\/masuk/);
        const loginBody = await page.textContent("body") ?? "";
        const hasLoginContent = loginBody.includes("Masuk") || loginBody.includes("Login") ||
          loginBody.includes("username");
        assertEquals(hasLoginContent, true, "US-07: unauthenticated access redirects to login");

        await loginAs(page, DISPLAY_USERNAME, DISPLAY_PASSWORD);

        await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
        const cabinCount = await page.locator(".train-cabin-wrap").count();
        assertGreater(cabinCount, 0, "US-07: at least one cabin should render on the wall");

        const activeVisible = await page
          .waitForFunction(
            () => document.querySelectorAll(".train-cabin-wrap--active").length > 0,
            { timeout: 10_000, polling: 500 },
          )
          .then(() => true)
          .catch(() => false);
        assertEquals(activeVisible, true, "US-08: an active cabin should be highlighted");
        assertGreater(cabinCount, 1, "US-08: wall shows multiple server-driven cabins");

        await page.goto(getBaseUrl() + "/api/masuk/logout").catch(() => {});
        await loginAs(page, MODERATOR_USERNAME, MODERATOR_PASSWORD);
        await page.goto(getBaseUrl() + "/concourse");
        await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
        const notNow = page.locator(".display-wall__fullscreen-prompt-secondary");
        if (await notNow.count() > 0) {
          await notNow.click();
          await page.waitForSelector(".display-wall__fullscreen-prompt", {
            state: "detached",
            timeout: 5_000,
          }).catch(() => {});
        }

        const controls = page.locator(".train-controls");
        assertEquals(await controls.count() > 0, true, "US-15: train controls should be visible");

        const pausePlayBtn = page.locator(".train-controls__btn").first();
        const initialLabel = (await pausePlayBtn.textContent())?.trim();
        assertEquals(
          initialLabel === "Pause" || initialLabel === "Play",
          true,
          "US-15: pause/play control should be present",
        );

        if (initialLabel === "Play") {
          await pausePlayBtn.click();
          await page.waitForFunction(
            () => {
              const btn = document.querySelector(".train-controls__btn");
              return btn && btn.textContent?.trim() === "Pause";
            },
            { timeout: 5_000 },
          );
          const afterLabel = (await pausePlayBtn.textContent())?.trim();
          assertEquals(afterLabel, "Pause", "US-15: clicking Play should resume the train");
        }

        await waitForTrackIdle(page);
        const statusBefore =
          (await page.locator(".train-controls__status").textContent())?.trim() ??
            "";
        const statusMatch = statusBefore.match(/\bCabin (\d+) of (\d+)\b/);
        assertEquals(statusMatch !== null, true, "US-15: cabin status exposes current and total");
        const currentCabin = Number(statusMatch?.[1]);
        const totalCabins = Number(statusMatch?.[2]);
        assertGreater(totalCabins, 1, "US-15: animation test needs more than one cabin");
        const jumpDistance = Math.min(3, totalCabins - 1);
        const targetCabin = (currentCabin - 1 + jumpDistance) % totalCabins + 1;

        const track = page.locator(".display-wall__track");
        const transformBefore = await track.evaluate((element) =>
          getComputedStyle(element).transform
        );
        const jumpInput = page.locator('.train-controls__jump input[type="number"]');
        assertEquals(await jumpInput.count() > 0, true, "US-15: jump-to-cabin input should exist");
        await jumpInput.fill(String(targetCabin));
        await page.locator(".train-controls__jump .train-controls__btn").click();
        await waitForTrackSliding(page);
        await page.waitForFunction(
          (initialTransform) => {
            const element = document.querySelector(".display-wall__track");
            return element !== null && getComputedStyle(element).transform !== initialTransform;
          },
          transformBefore,
          { timeout: 5_000 },
        );
        await waitForTrackIdle(page, 5_000);
        const statusAfter = (await page.locator(".train-controls__status").textContent())?.trim() ??
          "";
        assertEquals(
          statusAfter,
          `Cabin ${targetCabin} of ${totalCabins}`,
          "US-15: animated jump settles on the requested cabin",
        );

        await pausePlayBtn.click();
        await page.waitForFunction(
          () => {
            const btn = document.querySelector(".train-controls__btn");
            return btn && btn.textContent?.trim() === "Play";
          },
          { timeout: 5_000 },
        );
        await waitForTrackIdle(page);
      },
      {
        viewport: { width: 1920, height: 1080 },
        successScreenshot: "display-wall",
        visualBaseline: "display-wall",
      },
    );
  },
});
