import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsModerator,
  serveInfo,
} from "../../../lib/api/semak_route_test_helpers.ts";
import { submitTestSubmission } from "../../../tests/helpers.ts";
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
  name: "testModerateEventsSubmissionCreated",
  async fn() {
    await cleanupTestData();
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);

    const res = await handler(
      authedRequest("http://localhost/api/semak/events", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/event-stream");

    const reader = res.body!.getReader();
    const submitPromise = submitTestSubmission(handler);
    const [submission, event] = await Promise.all([
      submitPromise,
      readSseEvent(reader, "submission_created"),
    ]);

    assertEquals((event as { id: string }).id, submission.id);
    await reader.cancel();
    await cleanupTestData();
  },
});
