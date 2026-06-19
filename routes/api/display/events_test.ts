import { assertEquals } from "@std/assert";
import { submitTestSubmission, setupModeratorAndDisplayWall } from "../../../tests/helpers.ts";
import { authedRequest, createTestHandler, serveInfo } from "../../../lib/api/moderate_route_test_helpers.ts";
import { cleanupTestData } from "../../../lib/test_helpers.ts";

async function readSseEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expectedEvent: string,
  timeoutMs = 5000,
): Promise<unknown> {
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    const pattern = new RegExp(`event: ${expectedEvent}\\ndata: (.+)\\n\\n`);
    const match = buffer.match(pattern);
    if (match) return JSON.parse(match[1]);
  }
  throw new Error(`Timed out waiting for SSE event: ${expectedEvent}`);
}

Deno.test({
  name: "testDisplayEventsSubmissionApproved",
  async fn() {
    await cleanupTestData();
    const handler = await createTestHandler();
    const { moderator, displayWall } = await setupModeratorAndDisplayWall(handler);

    const res = await handler(
      authedRequest("http://localhost/api/display/events", displayWall.token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/event-stream");

    const reader = res.body!.getReader();
    const submission = await submitTestSubmission(handler);
    const approvePromise = handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, moderator.token, {
        method: "POST",
      }),
      serveInfo,
    );

    const [approveRes, event] = await Promise.all([
      approvePromise,
      readSseEvent(reader, "submission_approved"),
    ]);
    assertEquals(approveRes.status, 200);
    assertEquals((event as { id: string }).id, submission.id);

    await reader.cancel();
    await cleanupTestData();
  },
});
