import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_NOTICE, parseNotice } from "../src/notice.js";

test("an unset or blank notice means the default crypto anti-scam text", () => {
  assert.deepEqual(parseNotice(undefined), DEFAULT_NOTICE);
  assert.deepEqual(parseNotice("   "), DEFAULT_NOTICE);
  assert.match(DEFAULT_NOTICE.en, /seed phrase/);
});

test("off or none disables the notice", () => {
  assert.equal(parseNotice("off"), null);
  assert.equal(parseNotice(" OFF "), null);
  assert.equal(parseNotice("none"), null);
});

test("custom notice takes EN | RU or one text for both", () => {
  assert.deepEqual(parseNotice("We never ask for card details | Мы не просим данные карты"), {
    en: "We never ask for card details",
    ru: "Мы не просим данные карты",
  });
  assert.deepEqual(parseNotice("Stay safe"), { en: "Stay safe", ru: "Stay safe" });
  assert.deepEqual(parseNotice(" | Только русский"), { en: "Только русский", ru: "Только русский" });
});
