import { assertEquals, assertThrows } from "@std/assert";
import { parseSubmissionForm } from "./submission_request.ts";

const lengthConfig = { limit: 50, unit: "characters" as const };

function makeForm(entries: Record<string, string | File>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.append(key, value);
  }
  return form;
}

Deno.test("testSubmitValidSubmission", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
  const form = makeForm({
    photo: file,
    message: "Hello",
    submitter_name: "Alex",
    acknowledged: "true",
  });
  const { data } = parseSubmissionForm(form, lengthConfig);
  assertEquals(data.submitter_name, "Alex");
  assertEquals(data.message, "Hello");
});

Deno.test("testSubmitWithoutPhoto", () => {
  const form = makeForm({ message: "Hi", submitter_name: "Alex" });
  assertThrows(
    () => parseSubmissionForm(form, lengthConfig),
    Error,
    "Photo is required",
  );
});

Deno.test("testSubmitWithInvalidFileType", () => {
  const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" });
  const form = makeForm({ photo: file, message: "Hi", submitter_name: "Alex" });
  assertThrows(
    () => parseSubmissionForm(form, lengthConfig),
    Error,
    "Invalid file type",
  );
});

Deno.test("testSubmitWithoutAcknowledgment", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
  const form = makeForm({
    photo: file,
    message: "Hello",
    submitter_name: "Alex",
  });
  assertThrows(
    () => parseSubmissionForm(form, lengthConfig),
    Error,
    "Privacy notice acknowledgment is required",
  );
});

Deno.test("testSubmitWithOversizedFile", () => {
  const big = new Uint8Array(10 * 1024 * 1024 + 1);
  const file = new File([big], "big.jpg", { type: "image/jpeg" });
  const form = makeForm({ photo: file, message: "Hi", submitter_name: "Alex" });
  assertThrows(
    () => parseSubmissionForm(form, lengthConfig),
    Error,
    "File too large",
  );
});
