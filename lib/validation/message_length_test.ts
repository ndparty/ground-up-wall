import { assertEquals } from "@std/assert";
import {
  getRemainingLength,
  isMessageValid,
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
