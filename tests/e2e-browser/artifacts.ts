/**
 * Browser E2E artifact capture for local runs and CI uploads.
 * Failures: screenshot + HTML + console + error.
 * Success (when E2E_CAPTURE_SUCCESS_SHOT=1): PNG under success/.
 */

import type { Page } from "playwright";

const DEFAULT_DIR = "test-results/e2e-browser";

export type ConsoleBuffer = string[];

export function artifactsRoot(): string {
  return Deno.env.get("E2E_ARTIFACTS_DIR") ?? DEFAULT_DIR;
}

export function shouldCaptureSuccessShot(): boolean {
  return Deno.env.get("E2E_CAPTURE_SUCCESS_SHOT") === "1";
}

export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

export function attachConsole(page: Page): ConsoleBuffer {
  const lines: ConsoleBuffer = [];
  page.on("console", (msg) => {
    lines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    lines.push(`[pageerror] ${err.message}`);
  });
  return lines;
}

export async function captureFailure(
  page: Page,
  testName: string,
  error: unknown,
  consoleLines: ConsoleBuffer,
): Promise<void> {
  const dir = `${artifactsRoot()}/failures/${safeName(testName)}`;
  await ensureDir(dir);
  try {
    await page.screenshot({ path: `${dir}/screenshot.png`, fullPage: true });
  } catch (err) {
    await Deno.writeTextFile(
      `${dir}/screenshot-error.txt`,
      String(err),
    );
  }
  try {
    await Deno.writeTextFile(`${dir}/page.html`, await page.content());
  } catch (err) {
    await Deno.writeTextFile(`${dir}/page-html-error.txt`, String(err));
  }
  await Deno.writeTextFile(`${dir}/console.txt`, consoleLines.join("\n") + "\n");
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  await Deno.writeTextFile(`${dir}/error.txt`, message + "\n");
  await appendSummary({ failed: [testName] });
}

export async function captureSuccess(page: Page, shotName: string): Promise<void> {
  if (!shouldCaptureSuccessShot()) return;
  const dir = `${artifactsRoot()}/success`;
  await ensureDir(dir);
  const file = `${dir}/${safeName(shotName)}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await appendSummary({ screenshots: [`success/${safeName(shotName)}.png`] });
}

export async function recordPass(testName: string): Promise<void> {
  const dir = `${artifactsRoot()}/passed`;
  await ensureDir(dir);
  await Deno.writeTextFile(`${dir}/${safeName(testName)}.txt`, "ok\n");
  await appendSummary({ passed: [testName] });
}

type SummaryPatch = {
  passed?: string[];
  failed?: string[];
  screenshots?: string[];
};

type Summary = {
  suite: string;
  event: string;
  sha: string;
  passed: string[];
  failed: string[];
  screenshots: string[];
};

async function readSummary(): Promise<Summary> {
  const path = `${artifactsRoot()}/summary.json`;
  try {
    const raw = JSON.parse(await Deno.readTextFile(path)) as Partial<Summary>;
    return {
      suite: raw.suite ?? "e2e-browser",
      event: raw.event ?? Deno.env.get("GITHUB_EVENT_NAME") ?? "local",
      sha: raw.sha ?? Deno.env.get("GITHUB_SHA") ?? "",
      passed: raw.passed ?? [],
      failed: raw.failed ?? [],
      screenshots: raw.screenshots ?? [],
    };
  } catch {
    return {
      suite: "e2e-browser",
      event: Deno.env.get("GITHUB_EVENT_NAME") ?? "local",
      sha: Deno.env.get("GITHUB_SHA") ?? "",
      passed: [],
      failed: [],
      screenshots: [],
    };
  }
}

async function appendSummary(patch: SummaryPatch): Promise<void> {
  await ensureDir(artifactsRoot());
  const summary = await readSummary();
  if (patch.passed) {
    for (const p of patch.passed) {
      if (!summary.passed.includes(p)) summary.passed.push(p);
    }
  }
  if (patch.failed) {
    for (const f of patch.failed) {
      if (!summary.failed.includes(f)) summary.failed.push(f);
    }
  }
  if (patch.screenshots) {
    for (const s of patch.screenshots) {
      if (!summary.screenshots.includes(s)) summary.screenshots.push(s);
    }
  }
  await Deno.writeTextFile(
    `${artifactsRoot()}/summary.json`,
    JSON.stringify(summary, null, 2) + "\n",
  );
}
