import { assertEquals } from "@std/assert";
import {
  clampMessageToLimit,
  getRemainingLength,
  isAtMessageLimit,
  isMessageValid,
  normalizeMessageLengthConfig,
  type MessageLengthConfig,
} from "./message_length.ts";

const charConfig: MessageLengthConfig = { limit: 10, unit: "characters" };
const wordConfig: MessageLengthConfig = { limit: 3, unit: "words" };

Deno.test("testCharacterCountExact", () => {
  assertEquals(isMessageValid("1234567890", charConfig), true);
  assertEquals(getRemainingLength("1234567890", charConfig), 0);
});

Deno.test("testCharacterCountExceeded", () => {
  assertEquals(isMessageValid("12345678901", charConfig), false);
});

Deno.test("testCharacterCountUnicode", () => {
  assertEquals(isMessageValid("你好🎉", { limit: 3, unit: "characters" }), true);
  assertEquals(isMessageValid("你好🎉!", { limit: 3, unit: "characters" }), false);
});

Deno.test("testWordCountExact", () => {
  assertEquals(isMessageValid("one two three", wordConfig), true);
});

Deno.test("testWordCountExceeded", () => {
  assertEquals(isMessageValid("one two three four", wordConfig), false);
});

Deno.test("testEmptyMessage", () => {
  assertEquals(isMessageValid("", charConfig), true);
  assertEquals(isMessageValid("", wordConfig), true);
});

Deno.test("testNormalizeMessageLengthConfig", () => {
  assertEquals(normalizeMessageLengthConfig({ limit: undefined, unit: undefined }), {
    limit: 50,
    unit: "characters",
  });
  assertEquals(normalizeMessageLengthConfig({ limit: NaN, unit: "words" }), {
    limit: 50,
    unit: "words",
  });
  assertEquals(getRemainingLength("", normalizeMessageLengthConfig({ limit: 10, unit: "characters" })), 10);
});

Deno.test("testClampCharacters", () => {
  assertEquals(clampMessageToLimit("1234567890", charConfig), "1234567890");
  assertEquals(clampMessageToLimit("12345678901", charConfig), "1234567890");
});

Deno.test("testClampCharactersUnicode", () => {
  const config: MessageLengthConfig = { limit: 3, unit: "characters" };
  assertEquals(clampMessageToLimit("你好🎉!", config), "你好🎉");
});

Deno.test("testClampWords", () => {
  assertEquals(clampMessageToLimit("one two three", wordConfig), "one two three");
  assertEquals(clampMessageToLimit("one two three four", wordConfig), "one two three");
});

Deno.test("testClampWordsPreservesLeadingSpace", () => {
  assertEquals(clampMessageToLimit("  one two three four", wordConfig), "  one two three");
});

Deno.test("testIsAtMessageLimit", () => {
  assertEquals(isAtMessageLimit("1234567890", charConfig), true);
  assertEquals(isAtMessageLimit("123456789", charConfig), false);
  assertEquals(isAtMessageLimit("one two three", wordConfig), true);
  assertEquals(isAtMessageLimit("one two", wordConfig), false);
});
