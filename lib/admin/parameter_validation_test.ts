import { assertEquals } from "@std/assert";
import { normalizeWordListInput, validateParameterValue } from "./parameter_validation.ts";

Deno.test("testUpdateDwellTimeValid", () => {
  assertEquals(validateParameterValue("train_dwell_time", "10"), null);
});

Deno.test("testUpdateDwellTimeInvalid", () => {
  assertEquals(validateParameterValue("train_dwell_time", "0") !== null, true);
  assertEquals(validateParameterValue("train_dwell_time", "100") !== null, true);
});

Deno.test("testUpdatePromptText", () => {
  assertEquals(validateParameterValue("message_prompt_text", "Hello"), null);
});

Deno.test("testUpdateLengthUnit", () => {
  assertEquals(validateParameterValue("message_length_unit", "words"), null);
  assertEquals(validateParameterValue("message_length_unit", "invalid") !== null, true);
});

Deno.test("testUpdateWordList", () => {
  const stored = normalizeWordListInput("bad, word\nanother");
  assertEquals(stored, '["bad","word","another"]');
});

Deno.test("testPublicParticipantUrl valid base URL", () => {
  assertEquals(validateParameterValue("public_participant_url", ""), null);
  assertEquals(
    validateParameterValue("public_participant_url", "http://192.168.1.5:8080"),
    null,
  );
});

Deno.test("testPublicParticipantUrl rejects deep links", () => {
  assertEquals(
    validateParameterValue("public_participant_url", "http://192.168.1.5:8080/muatnaik") !== null,
    true,
  );
});
