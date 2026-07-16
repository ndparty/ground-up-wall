import { encodeBase64 } from "@std/encoding/base64";
import { basename, join } from "@std/path";

type E2eSummary = {
  suite?: string;
  event?: string;
  sha?: string;
  jobOutcome?: string;
  passed?: string[];
  failed?: string[];
  screenshots?: string[];
};

type VisualDiff = {
  name: string;
  expected?: string;
  actual?: string;
  diff?: string;
};

type FailurePack = {
  name: string;
  screenshot?: string;
  error: string;
  console: string;
  pageHtml: string;
  captureErrors: string;
};

const FEATURED_VISUAL_EVIDENCE = [
  "display-wall-jump-animation-filmstrip.png",
  "station-sign-matrix.png",
] as const;

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function readText(path: string, fallback = ""): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return fallback;
    throw error;
  }
}

async function imageDataUrl(path: string | undefined): Promise<string | null> {
  if (!path || !(await exists(path))) return null;
  return `data:image/png;base64,${encodeBase64(await Deno.readFile(path))}`;
}

async function pngFiles(dir: string): Promise<string[]> {
  try {
    const files: string[] = [];
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith(".png")) {
        files.push(join(dir, entry.name));
      }
    }
    return files.sort();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
}

async function filesWithSuffix(dir: string, suffix: string): Promise<string[]> {
  try {
    const files: string[] = [];
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith(suffix)) {
        files.push(entry.name.slice(0, -suffix.length));
      }
    }
    return files.sort();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
}

async function collectVisualDiffs(root: string): Promise<VisualDiff[]> {
  const grouped = new Map<string, VisualDiff>();
  for (const path of await pngFiles(join(root, "visual-diff"))) {
    const match = basename(path).match(/^(.*)\.(expected|actual|diff)\.png$/);
    if (!match) continue;
    const [, name, kind] = match;
    const group = grouped.get(name) ?? { name };
    group[kind as "expected" | "actual" | "diff"] = path;
    grouped.set(name, group);
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function collectFailures(root: string): Promise<FailurePack[]> {
  const failuresDir = join(root, "failures");
  try {
    const failures: FailurePack[] = [];
    for await (const entry of Deno.readDir(failuresDir)) {
      if (!entry.isDirectory) continue;
      const dir = join(failuresDir, entry.name);
      const screenshot = join(dir, "screenshot.png");
      failures.push({
        name: entry.name,
        screenshot: await exists(screenshot) ? screenshot : undefined,
        error: await readText(join(dir, "error.txt"), "No error text was captured."),
        console: await readText(join(dir, "console.txt"), "No console output was captured."),
        pageHtml: await readText(join(dir, "page.html")),
        captureErrors: [
          await readText(join(dir, "screenshot-error.txt")),
          await readText(join(dir, "page-html-error.txt")),
        ].filter(Boolean).join("\n"),
      });
    }
    return failures.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
}

function testList(title: string, names: string[], className: string): string {
  const items = names.length === 0
    ? '<li class="muted">None</li>'
    : names.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  return `<section><h2>${escapeHtml(title)}</h2><ul class="${className}">${items}</ul></section>`;
}

async function imageFigure(path: string, caption: string, className = ""): Promise<string> {
  const src = await imageDataUrl(path);
  if (!src) return "";
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  return `<figure${classAttribute}><img src="${src}" alt="${escapeHtml(caption)}"><figcaption>${
    escapeHtml(caption)
  }</figcaption></figure>`;
}

export async function buildE2eReport(root: string): Promise<string> {
  let summary: E2eSummary = {};
  try {
    summary = JSON.parse(await Deno.readTextFile(join(root, "summary.json"))) as E2eSummary;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound) && !(error instanceof SyntaxError)) throw error;
  }

  const summaryPassed = Array.isArray(summary.passed)
    ? summary.passed.filter((value): value is string => typeof value === "string")
    : [];
  const summaryFailed = Array.isArray(summary.failed)
    ? summary.failed.filter((value): value is string => typeof value === "string")
    : [];
  const markerPassed = await filesWithSuffix(join(root, "passed"), ".txt");
  const failures = await collectFailures(root);
  const safeArtifactName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const filesystemFailureNames = failures.map((failure) =>
    summaryFailed.find((name) => safeArtifactName(name) === failure.name) ?? failure.name
  );
  const failed = [...new Set([...summaryFailed, ...filesystemFailureNames])];
  const failedSafeNames = new Set(failed.map(safeArtifactName));
  const passed = [...new Set([...summaryPassed, ...markerPassed])].filter((name) =>
    !failedSafeNames.has(safeArtifactName(name))
  );
  const successPaths = await pngFiles(join(root, "success"));
  const visualSuccessPaths = await pngFiles(join(root, "visual-success"));
  const visualDiffs = await collectVisualDiffs(root);
  const outcome = failed.length > 0
    ? "failure"
    : typeof summary.jobOutcome === "string"
    ? summary.jobOutcome
    : "success";
  const event = typeof summary.event === "string" ? summary.event : "unknown";
  const sha = typeof summary.sha === "string" ? summary.sha : "";
  const successFigures = (
    await Promise.all(successPaths.map((path) => imageFigure(path, basename(path))))
  ).join("");
  const featuredVisualPaths = FEATURED_VISUAL_EVIDENCE.flatMap((name) => {
    const path = visualSuccessPaths.find((candidate) => basename(candidate) === name);
    return path ? [path] : [];
  });
  const featuredNames = new Set(featuredVisualPaths.map((path) => basename(path)));
  const galleryVisualPaths = visualSuccessPaths.filter((path) =>
    !featuredNames.has(basename(path))
  );
  const featuredVisualFigures = (
    await Promise.all(
      featuredVisualPaths.map((path) =>
        imageFigure(
          path,
          `Featured: ${basename(path)}`,
          basename(path) === FEATURED_VISUAL_EVIDENCE[0] ? "featured-filmstrip" : "",
        )
      ),
    )
  ).join("");
  const galleryVisualFigures = (
    await Promise.all(galleryVisualPaths.map((path) => imageFigure(path, basename(path))))
  ).join("");
  const diffSections = (
    await Promise.all(visualDiffs.map(async (visual) => {
      const figures = (
        await Promise.all([
          visual.expected ? imageFigure(visual.expected, `${visual.name}: expected`) : "",
          visual.actual ? imageFigure(visual.actual, `${visual.name}: actual`) : "",
          visual.diff ? imageFigure(visual.diff, `${visual.name}: diff`) : "",
        ])
      ).join("");
      return `<article class="card"><h3>${escapeHtml(visual.name)}</h3><div class="grid">${
        figures || '<p class="muted">No diff images were captured.</p>'
      }</div></article>`;
    }))
  ).join("");
  const failureSections = (
    await Promise.all(failures.map(async (failure) => {
      const shot = failure.screenshot
        ? await imageFigure(failure.screenshot, `${failure.name}: failure screenshot`)
        : "";
      const consoleExcerpt = failure.console.slice(-20_000);
      const pageExcerpt = failure.pageHtml.slice(0, 20_000);
      return `<article class="card"><h3>${escapeHtml(failure.name)}</h3>${shot}` +
        `<h4>Error</h4><pre>${escapeHtml(failure.error)}</pre>` +
        `<h4>Console (last 20,000 characters)</h4><pre>${escapeHtml(consoleExcerpt)}</pre>` +
        (failure.captureErrors
          ? `<h4>Capture diagnostics</h4><pre>${escapeHtml(failure.captureErrors)}</pre>`
          : "") +
        (pageExcerpt
          ? `<details><summary>Captured page HTML (first 20,000 characters)</summary><pre>${
            escapeHtml(pageExcerpt)
          }</pre></details>`
          : "") +
        `</article>`;
    }))
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>E2E visual report</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,sans-serif}
body{max-width:1440px;margin:auto;padding:24px;line-height:1.5}
header,.card,section{border:1px solid #8886;border-radius:12px;padding:16px;margin:0 0 20px}
.meta{display:flex;gap:12px;flex-wrap:wrap}.pill{border-radius:999px;padding:4px 10px;background:#8882}
.success{color:#16803c}.failure{color:#c52d2d}.muted{opacity:.7}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.featured{display:grid;grid-template-columns:1fr;gap:20px}.visual-gallery{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.featured-filmstrip{max-width:100%;overflow-x:auto}.featured-filmstrip img{display:block;max-width:none}
figure{margin:0}img{max-width:100%;height:auto;border:1px solid #8886;border-radius:8px}
figcaption{font-size:.9rem;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:#8882;border-radius:8px}
ul{padding-left:24px}
</style>
</head>
<body>
<header>
<h1>E2E visual report</h1>
<div class="meta">
<span class="pill ${escapeHtml(outcome)}">Outcome: ${escapeHtml(outcome)}</span>
<span class="pill">Passed: ${passed.length}</span><span class="pill">Failed: ${failed.length}</span>
<span class="pill">Visual evidence: ${visualSuccessPaths.length}</span>
<span class="pill">Event: ${escapeHtml(event)}</span>
<span class="pill">SHA: ${escapeHtml(sha)}</span>
</div>
</header>
<div class="grid">
${testList("Passed tests", passed, "success")}
${testList("Failed tests", failed, "failure")}
</div>
<section><h2>Success screenshots</h2><div class="grid">${
    successFigures || '<p class="muted">No success screenshots were captured.</p>'
  }</div></section>
<section><h2>Featured visual evidence</h2>
<p class="muted">The animation filmstrip is shown at native resolution; scroll horizontally to inspect train text and keyframes.</p>
<div class="featured">${
    featuredVisualFigures || '<p class="muted">No featured visual evidence was captured.</p>'
  }</div></section>
<section><h2>All other successful visual comparisons</h2><div class="grid visual-gallery">${
    galleryVisualFigures ||
    '<p class="muted">No additional successful comparisons were captured.</p>'
  }</div></section>
<section><h2>Visual differences</h2>${
    diffSections || '<p class="muted">No visual differences were captured.</p>'
  }</section>
<section><h2>Failure details</h2>${
    failureSections || '<p class="muted">No failure packs were captured.</p>'
  }</section>
</body>
</html>
`;
}

export async function generateE2eReport(
  root = Deno.env.get("E2E_ARTIFACTS_DIR") ?? "test-results/e2e-browser",
  output = join(root, "report.html"),
): Promise<void> {
  await Deno.mkdir(root, { recursive: true });
  await Deno.writeTextFile(output, await buildE2eReport(root));
}

if (import.meta.main) {
  await generateE2eReport();
}
