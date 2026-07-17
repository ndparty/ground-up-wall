import { assertEquals, assertGreater } from "@std/assert";
import { jumpSlideDurationMs } from "../../lib/train/slide_duration.ts";
import {
  assertMonotonicTransform,
  captureAnimationBoundaries,
  compareAnimationBoundarySequence,
  composeFilmstrip,
  seekTransformAnimation,
} from "./animation.ts";
import { createSubmissionFixture, moderateFixture } from "./fixtures.ts";
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  captureVisualBaseline,
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
import { comparePng } from "./visual.ts";

async function sendTrainCommand(
  page: import("playwright").Page,
  command: { type: "play" | "pause" | "jump"; cabinNumber?: number },
): Promise<void> {
  const result = await page.evaluate(async (command) => {
    const response = await fetch("/api/concourse/train-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    return { ok: response.ok, status: response.status };
  }, command);
  if (!result.ok) throw new Error(`${command.type} command failed: HTTP ${result.status}`);
}

async function resetPlaybackForE2e(page: import("playwright").Page): Promise<void> {
  await sendTrainCommand(page, { type: "play" });
  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append("type", "reload");
    const response = await fetch("/api/semak/display-override", { method: "POST", body: form });
    if (!response.ok) return { ok: false, status: response.status };
    const playbackResponse = await fetch("/api/concourse/submissions");
    const body = await playbackResponse.json() as {
      playback: { currentCabin: number; isPlaying: boolean };
    };
    return {
      ok: playbackResponse.ok && body.playback.currentCabin === 1 && body.playback.isPlaying,
      status: playbackResponse.status,
    };
  });
  if (!result.ok) {
    throw new Error(`Failed to reset E2E playback: HTTP ${result.status}`);
  }
  if (await page.locator(".display-wall").count() > 0) {
    await page.locator('.display-wall[data-e2e-current-cabin="1"][data-e2e-is-playing="true"]')
      .waitFor({ state: "visible", timeout: 10_000 });
    await waitForTrackIdle(page);
  }
}

Deno.test({
  name: "Feature 3: Display Wall (US-07, US-08, US-15)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 3: Display Wall (US-07, US-08, US-15)",
      async ({ page }) => {
        let playbackCanReset = false;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
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
          playbackCanReset = true;
          await resetPlaybackForE2e(page);
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
          await captureVisualBaseline(page, "display-wall-playing-idle-static", {
            mask: [".display-wall__join-text"],
          });
          const statusBefore =
            (await page.locator(".train-controls__status").textContent())?.trim() ??
              "";
          const statusMatch = statusBefore.match(/\bCabin (\d+) of (\d+)\b/);
          assertEquals(statusMatch !== null, true, "US-15: cabin status exposes current and total");
          const currentCabin = Number(statusMatch?.[1]);
          const totalCabins = Number(statusMatch?.[2]);
          assertGreater(totalCabins, 1, "US-15: animation test needs more than one cabin");
          const jumpDistance = Math.min(9, totalCabins - 1);
          const targetCabin = (currentCabin - 1 + jumpDistance) % totalCabins + 1;

          const track = page.locator(".display-wall__track");
          const transformBefore = await track.evaluate((element) =>
            getComputedStyle(element).transform
          );
          const jumpInput = page.locator('.train-controls__jump input[type="number"]');
          assertEquals(
            await jumpInput.count() > 0,
            true,
            "US-15: jump-to-cabin input should exist",
          );
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
          const seeked = await seekTransformAnimation(
            page,
            ".display-wall__track",
            ".display-wall__stage",
          );
          const travelledSlots = Math.abs(seeked.endX - seeked.startX) / seeked.slotPitchPx;
          const animationSteps = Math.round(travelledSlots);
          assertEquals(
            Math.abs(travelledSlots - animationSteps) <= 0.05 && animationSteps > 0,
            true,
            "FR-20: jump travels a whole number of cabin slots",
          );
          assertEquals(
            seeked.durationMs,
            jumpSlideDurationMs(animationSteps),
            "FR-20: jump transition uses the configured distance-based duration",
          );
          assertEquals(seeked.easing, "ease-in-out", "FR-20: jump transition uses smooth easing");
          assertMonotonicTransform(seeked.samples);
          assertEquals(
            seeked.endCenterOffset <= 1.5,
            true,
            "FR-20: the final seeked frame centers a cabin without an end snap",
          );
          if (seeked.keyframePngs.length > 0) {
            await comparePng(
              "display-wall-jump-animation-filmstrip",
              await composeFilmstrip(seeked.keyframePngs, 8, 1),
            );
            await compareAnimationBoundarySequence(
              "display-wall-track-transform",
              ".display-wall__track",
              {
                durationMs: seeked.durationMs,
                easing: seeked.easing,
                frames: seeked.boundaryFrames,
              },
            );
          }
          await waitForTrackIdle(page, 5_000);
          if (seeked.boundaryFrames.length > 0) {
            const highlight = await captureAnimationBoundaries(page, {
              animationSelector: ".train-cabin-wrap--active",
              captureSelector: ".train-cabin-wrap--active",
              transitionProperty: "opacity",
            });
            await compareAnimationBoundarySequence(
              "display-wall-cabin-highlight",
              ".train-cabin-wrap--active",
              highlight,
            );
          }
          const settledCenterOffset = await page.evaluate(() => {
            const stage = document.querySelector<HTMLElement>(".display-wall__stage");
            const active = document.querySelector<HTMLElement>(".train-cabin-wrap--active");
            if (!stage || !active) return Number.POSITIVE_INFINITY;
            const stageRect = stage.getBoundingClientRect();
            const activeRect = active.getBoundingClientRect();
            return Math.abs(
              activeRect.left + activeRect.width / 2 -
                (stageRect.left + stageRect.width / 2),
            );
          });
          assertEquals(
            settledCenterOffset <= 1.5,
            true,
            "FR-20: the settled active cabin remains centered after animation commit",
          );
          const statusAfter =
            (await page.locator(".train-controls__status").textContent())?.trim() ??
              "";
          assertEquals(
            statusAfter,
            `Cabin ${targetCabin} of ${totalCabins}`,
            "US-15: animated jump settles on the requested cabin",
          );
          await captureVisualBaseline(page, "display-wall-post-jump-static", {
            mask: [".display-wall__join-text"],
          });

          await pausePlayBtn.click();
          await page.waitForFunction(
            () => {
              const btn = document.querySelector(".train-controls__btn");
              return btn && btn.textContent?.trim() === "Play";
            },
            { timeout: 5_000 },
          );
          await waitForTrackIdle(page);
          await captureVisualBaseline(page, "display-wall-paused-static", {
            mask: [".display-wall__join-text"],
          });
          await captureVisualBaseline(page, "display-wall", {
            mask: [".display-wall__join-text"],
          });
        } catch (error) {
          testFailure = error;
        } finally {
          if (playbackCanReset) {
            try {
              await resetPlaybackForE2e(page);
            } catch (error) {
              cleanupFailure = error;
            }
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "Display behavior and playback reset both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      {
        viewport: { width: 1920, height: 1080 },
        successScreenshot: "display-wall",
      },
    );
  },
});

Deno.test({
  name: "Feature 3: Realtime approval and authoritative refresh - US-08",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Feature 3: Realtime approval and authoritative refresh - US-08",
      async ({ page, browser }) => {
        const adminContext = await browser.newContext({
          viewport: { width: 1280, height: 800 },
        });
        const adminPage = await adminContext.newPage();
        const previousDwellOverride = Deno.env.get("E2E_TRAIN_DWELL_SECONDS");
        let fixtureId: string | null = null;
        let originalDwell: string | null = null;
        let testFailure: unknown = null;
        let cleanupFailure: unknown = null;
        try {
          Deno.env.set("E2E_TRAIN_DWELL_SECONDS", "3");
          const sseReady = page.waitForResponse((response) =>
            response.url().includes("/api/concourse/events") && response.status() === 200
          );
          await loginAs(page, DISPLAY_USERNAME, DISPLAY_PASSWORD);
          await sseReady;
          await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });

          await loginAs(adminPage, ADMIN_USERNAME, ADMIN_PASSWORD);
          originalDwell = await adminPage.evaluate(async () => {
            const response = await fetch("/api/towkay/parameters");
            const rows = await response.json() as Array<{ key: string; value: string }>;
            const dwell = rows.find((row) => row.key === "train_dwell_time");
            if (!dwell) throw new Error("Missing train_dwell_time");
            return dwell.value;
          });
          await adminPage.evaluate(async (value) => {
            const response = await fetch("/api/towkay/parameters/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: "train_dwell_time", value }),
            });
            if (!response.ok) throw new Error(`Dwell update failed: ${response.status}`);
          }, originalDwell);
          await resetPlaybackForE2e(adminPage);

          const fixture = await createSubmissionFixture(adminPage, {
            name: "E2E Realtime Fixture",
            message: "Approved while the display remains open",
          });
          fixtureId = fixture.submission_id;

          await adminPage.goto(getBaseUrl() + "/semak");
          const fixtureCard = adminPage.locator(
            `.submission-card[data-submission-id="${fixture.submission_id}"]`,
          );
          await fixtureCard.waitFor({ state: "visible", timeout: 15_000 });
          const approvedAt = Date.now();
          await fixtureCard.locator(".btn--approve").click();
          await fixtureCard.waitFor({ state: "hidden", timeout: 15_000 });

          await waitForTrackSliding(page, 30_000);
          await waitForTrackIdle(page, 10_000);
          await page.locator(
            `.train-cabin-wrap[data-submission-id="${fixture.submission_id}"]`,
          ).waitFor({
            state: "visible",
            timeout: 30_000,
          });
          assertEquals(
            Date.now() - approvedAt < 30_000,
            true,
            "US-08: realtime approval appears through normal playback within 30 seconds",
          );

          await sendTrainCommand(adminPage, { type: "pause" });
          await page.locator('.display-wall[data-e2e-is-playing="false"]').waitFor({
            state: "visible",
            timeout: 10_000,
          });
          await waitForTrackIdle(page);
          const beforeRefresh = await page.locator(".display-wall").evaluate(
            (element, fixtureId) => ({
              currentCabin: element.getAttribute("data-e2e-current-cabin"),
              isPlaying: element.getAttribute("data-e2e-is-playing"),
              fixtureVisible: document.querySelector(
                `.train-cabin-wrap[data-submission-id="${fixtureId}"]`,
              ) !== null,
            }),
            fixture.submission_id,
          );
          await page.reload();
          await page.waitForSelector(".train-cabin-wrap", { timeout: 15_000 });
          await waitForTrackIdle(page);
          const afterRefresh = await page.locator(".display-wall").evaluate(
            (element, fixtureId) => ({
              currentCabin: element.getAttribute("data-e2e-current-cabin"),
              isPlaying: element.getAttribute("data-e2e-is-playing"),
              fixtureVisible: document.querySelector(
                `.train-cabin-wrap[data-submission-id="${fixtureId}"]`,
              ) !== null,
            }),
            fixture.submission_id,
          );
          assertEquals(
            afterRefresh,
            beforeRefresh,
            "US-08: refreshed UI restores cabin content, position, and play/pause state",
          );
        } catch (error) {
          testFailure = error;
        } finally {
          const cleanupErrors: unknown[] = [];
          if (previousDwellOverride === undefined) {
            Deno.env.delete("E2E_TRAIN_DWELL_SECONDS");
          } else {
            Deno.env.set("E2E_TRAIN_DWELL_SECONDS", previousDwellOverride);
          }
          if (originalDwell !== null) {
            try {
              await adminPage.evaluate(async (value) => {
                const response = await fetch("/api/towkay/parameters/update", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: "train_dwell_time", value }),
                });
                if (!response.ok) throw new Error(`Dwell restore failed: ${response.status}`);
              }, originalDwell);
            } catch (error) {
              cleanupErrors.push(error);
            }
          }
          if (fixtureId) {
            try {
              await moderateFixture(adminPage, "delete", fixtureId);
            } catch (error) {
              cleanupErrors.push(error);
            }
          }
          try {
            await resetPlaybackForE2e(adminPage);
          } catch (error) {
            cleanupErrors.push(error);
          }
          try {
            await adminContext.close();
          } catch (error) {
            cleanupErrors.push(error);
          }
          if (cleanupErrors.length > 0) {
            cleanupFailure = new AggregateError(cleanupErrors, "US-08 cleanup failed");
          }
        }
        if (testFailure !== null && cleanupFailure !== null) {
          throw new AggregateError(
            [testFailure, cleanupFailure],
            "US-08 realtime behavior and cleanup both failed",
          );
        }
        if (cleanupFailure !== null) throw cleanupFailure;
        if (testFailure !== null) throw testFailure;
      },
      { viewport: { width: 1920, height: 1080 } },
    );
  },
});
