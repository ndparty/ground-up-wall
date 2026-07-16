import { encodeBase64 } from "@std/encoding/base64";
import type { Page } from "playwright";
import { testJpegBlob } from "../../lib/image/test_jpeg.ts";
import { getBaseUrl } from "./helpers.ts";

export type CreatedSubmission = {
  submission_id: string;
  status: "pending" | "approved";
  is_flagged: boolean;
};

export async function submitFixtureRequest(
  page: Page,
  options: { name: string; message: string; acknowledged?: boolean },
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  if (!page.url().startsWith(getBaseUrl())) await page.goto(getBaseUrl() + "/muatnaik");
  const bytes = encodeBase64(new Uint8Array(await testJpegBlob().arrayBuffer()));
  return await page.evaluate(
    async ({ bytes, name, message, acknowledged }) => {
      const binary = atob(bytes);
      const data = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) data[index] = binary.charCodeAt(index);
      const form = new FormData();
      form.append("photo", new Blob([data], { type: "image/jpeg" }), "e2e-fixture.jpg");
      form.append("message", message);
      form.append("submitter_name", name);
      form.append("acknowledged", acknowledged ? "true" : "false");
      const response = await fetch("/api/muatnaik/submit", { method: "POST", body: form });
      return {
        ok: response.ok,
        status: response.status,
        body: await response.json() as Record<string, unknown>,
      };
    },
    {
      bytes,
      name: options.name,
      message: options.message,
      acknowledged: options.acknowledged ?? true,
    },
  );
}

export async function createSubmissionFixture(
  page: Page,
  options: { name: string; message: string; acknowledged?: boolean },
): Promise<CreatedSubmission> {
  const result = await submitFixtureRequest(page, options);
  if (!result.ok) {
    throw new Error(
      `Fixture upload failed: HTTP ${result.status} ${JSON.stringify(result.body)}`,
    );
  }
  return result.body as CreatedSubmission;
}

export async function moderateFixture(
  page: Page,
  action: "approve" | "reject" | "delete",
  submissionId: string,
): Promise<void> {
  const response = await page.evaluate(
    async ({ action, submissionId }) => {
      const result = await fetch(`/api/semak/${action}/${submissionId}`, { method: "POST" });
      return { ok: result.ok, status: result.status, text: await result.text() };
    },
    { action, submissionId },
  );
  if (!response.ok) {
    throw new Error(
      `Fixture ${action} failed for ${submissionId}: HTTP ${response.status} ${response.text}`,
    );
  }
}
