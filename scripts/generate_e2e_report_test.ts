import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { buildE2eReport, escapeHtml, generateE2eReport } from "./generate_e2e_report.ts";

Deno.test("escapeHtml escapes report-controlled text", () => {
  assertEquals(
    escapeHtml(`<script data-x="1">alert('x') & more</script>`),
    "&lt;script data-x=&quot;1&quot;&gt;alert(&#39;x&#39;) &amp; more&lt;/script&gt;",
  );
});

Deno.test("E2E report embeds success, diff, and failure evidence", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(root, "success"), { recursive: true });
    await Deno.mkdir(join(root, "visual-success"), { recursive: true });
    await Deno.mkdir(join(root, "visual-diff"), { recursive: true });
    await Deno.mkdir(join(root, "failures", "broken_test"), { recursive: true });
    const png = new Uint8Array([137, 80, 78, 71]);
    await Deno.writeFile(join(root, "success", "green.png"), png);
    await Deno.writeFile(
      join(root, "visual-success", "display-wall-jump-animation-filmstrip.png"),
      png,
    );
    await Deno.writeFile(join(root, "visual-success", "station-sign-matrix.png"), png);
    await Deno.writeFile(join(root, "visual-success", "upload-form.png"), png);
    await Deno.writeFile(join(root, "visual-diff", "wall.expected.png"), png);
    await Deno.writeFile(join(root, "visual-diff", "wall.actual.png"), png);
    await Deno.writeFile(join(root, "visual-diff", "wall.diff.png"), png);
    await Deno.writeFile(join(root, "failures", "broken_test", "screenshot.png"), png);
    await Deno.writeTextFile(
      join(root, "failures", "broken_test", "error.txt"),
      "<script>unsafe()</script>",
    );
    await Deno.writeTextFile(
      join(root, "failures", "broken_test", "console.txt"),
      "console & details",
    );
    await Deno.writeTextFile(
      join(root, "failures", "broken_test", "page.html"),
      '<img src=x onerror="unsafe()">',
    );
    await Deno.writeTextFile(
      join(root, "failures", "broken_test", "screenshot-error.txt"),
      'capture "failed"',
    );
    await Deno.writeTextFile(
      join(root, "summary.json"),
      JSON.stringify({
        event: "pull_request",
        sha: "abc123",
        jobOutcome: "failure",
        passed: ["green test"],
        failed: ["broken <test>"],
        screenshots: ["success/green.png"],
      }),
    );

    const html = await buildE2eReport(root);
    assertEquals(await buildE2eReport(root), html, "report output is deterministic");
    assertStringIncludes(html, "Outcome: failure");
    assertStringIncludes(html, "broken &lt;test&gt;");
    assertStringIncludes(html, "&lt;script&gt;unsafe()&lt;/script&gt;");
    assertStringIncludes(html, "data:image/png;base64,iVBORw==");
    assertStringIncludes(html, "wall: expected");
    assertStringIncludes(html, "Visual evidence: 3");
    assertStringIncludes(html, "Featured: display-wall-jump-animation-filmstrip.png");
    assertStringIncludes(html, "Featured: station-sign-matrix.png");
    assertStringIncludes(html, "All other successful visual comparisons");
    assertStringIncludes(html, "upload-form.png");
    assertStringIncludes(html, "Content-Security-Policy");
    assertStringIncludes(html, "&lt;img src=x onerror=&quot;unsafe()&quot;&gt;");
    assertStringIncludes(html, "capture &quot;failed&quot;");
    assertEquals(html.includes("<script>unsafe()</script>"), false);
    assertEquals(
      html.indexOf("Featured: display-wall-jump-animation-filmstrip.png") <
        html.indexOf("Featured: station-sign-matrix.png"),
      true,
    );
    assertEquals(
      html.indexOf("Featured: station-sign-matrix.png") <
        html.indexOf("All other successful visual comparisons"),
      true,
    );
    assertEquals(
      html.split("display-wall-jump-animation-filmstrip.png").length - 1,
      2,
      "featured evidence appears once (image alt plus caption), not again in the gallery",
    );

    const output = join(root, "custom-report.html");
    await generateE2eReport(root, output);
    assertEquals(await Deno.readTextFile(output), html);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("E2E report tolerates malformed summary fields and lets failures win", async () => {
  const root = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(root, "passed"), { recursive: true });
    await Deno.mkdir(join(root, "failures", "same_test"), { recursive: true });
    await Deno.writeTextFile(join(root, "passed", "same_test.txt"), "ok\n");
    await Deno.writeTextFile(
      join(root, "failures", "same_test", "error.txt"),
      "failed after cleanup",
    );
    await Deno.writeTextFile(
      join(root, "summary.json"),
      JSON.stringify({ passed: "not-an-array", failed: null, event: { unsafe: true }, sha: 42 }),
    );

    const html = await buildE2eReport(root);
    assertStringIncludes(html, "Outcome: failure");
    assertStringIncludes(html, "Failed: 1");
    assertStringIncludes(html, "Passed: 0");
    assertStringIncludes(html, "Event: unknown");
    assertStringIncludes(html, "Visual evidence: 0");
    assertStringIncludes(html, "No featured visual evidence was captured.");
    assertStringIncludes(html, "No additional successful comparisons were captured.");
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
