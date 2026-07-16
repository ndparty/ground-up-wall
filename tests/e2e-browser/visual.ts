import type { Page } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { Buffer } from "node:buffer";
import { artifactsRoot, safeName } from "./artifacts.ts";

const BASELINES_DIR = "tests/e2e-browser/baselines";

export type VisualCompareOptions = {
  maxDiffRatio?: number;
  threshold?: number;
};

export function visualComparisonsEnabled(): boolean {
  return Deno.env.get("E2E_VISUAL") === "1" ||
    Deno.env.get("E2E_UPDATE_BASELINES") === "1";
}

async function captureStablePng(page: Page): Promise<Uint8Array> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  return await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: true,
  });
}

async function writePng(path: string, bytes: Uint8Array): Promise<void> {
  const separator = path.lastIndexOf("/");
  if (separator > 0) {
    await Deno.mkdir(path.slice(0, separator), { recursive: true });
  }
  await Deno.writeFile(path, bytes);
}

/**
 * Compare a stable page screenshot with its committed baseline.
 *
 * E2E_UPDATE_BASELINES=1 rewrites the baseline instead of comparing.
 * E2E_VISUAL=1 enables comparison; otherwise this is a no-op.
 */
export async function compareScreenshot(
  page: Page,
  name: string,
  options: VisualCompareOptions = {},
): Promise<void> {
  if (!visualComparisonsEnabled()) return;

  const fileName = `${safeName(name)}.png`;
  const baselinePath = `${BASELINES_DIR}/${fileName}`;
  const actualBytes = await captureStablePng(page);

  if (Deno.env.get("E2E_UPDATE_BASELINES") === "1") {
    await writePng(baselinePath, actualBytes);
    await writePng(
      `${artifactsRoot()}/generated-baselines/${fileName}`,
      actualBytes,
    );
    return;
  }

  let expectedBytes: Uint8Array;
  try {
    expectedBytes = await Deno.readFile(baselinePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Missing visual baseline ${baselinePath}. Run with E2E_UPDATE_BASELINES=1.`,
      );
    }
    throw error;
  }

  const actual = PNG.sync.read(Buffer.from(actualBytes));
  const expected = PNG.sync.read(Buffer.from(expectedBytes));
  const diffDir = `${artifactsRoot()}/visual-diff`;
  const stem = `${diffDir}/${safeName(name)}`;

  if (actual.width !== expected.width || actual.height !== expected.height) {
    await writePng(`${stem}.actual.png`, actualBytes);
    await writePng(`${stem}.expected.png`, expectedBytes);
    throw new Error(
      `Visual baseline dimensions differ for ${name}: ` +
        `expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`,
    );
  }

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: options.threshold ?? 0.2 },
  );
  const diffRatio = diffPixels / (actual.width * actual.height);
  const maxDiffRatio = options.maxDiffRatio ?? 0.001;

  if (diffRatio > maxDiffRatio) {
    await Deno.mkdir(diffDir, { recursive: true });
    await writePng(`${stem}.actual.png`, actualBytes);
    await writePng(`${stem}.expected.png`, expectedBytes);
    await writePng(`${stem}.diff.png`, PNG.sync.write(diff));
    throw new Error(
      `Visual regression in ${name}: ${(diffRatio * 100).toFixed(3)}% pixels differ ` +
        `(allowed ${(maxDiffRatio * 100).toFixed(3)}%)`,
    );
  }
}
