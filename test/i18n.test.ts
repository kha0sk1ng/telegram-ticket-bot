import assert from "node:assert/strict";
import test from "node:test";
import { detectLang, escapeHtml, messages, stars } from "../src/i18n.js";

test("detectLang maps Russian-speaking locales to ru and everything else to en", () => {
  assert.equal(detectLang("ru"), "ru");
  assert.equal(detectLang("uk"), "ru");
  assert.equal(detectLang("be"), "ru");
  assert.equal(detectLang("kk"), "ru");
  assert.equal(detectLang("en"), "en");
  assert.equal(detectLang("en-US"), "en");
  assert.equal(detectLang("de"), "en");
  assert.equal(detectLang(undefined), "en");
});

test("both languages define exactly the same message keys", () => {
  assert.deepEqual(Object.keys(messages.ru).sort(), Object.keys(messages.en).sort());
});

test("every message renders non-empty text in both languages", () => {
  for (const lang of ["ru", "en"] as const) {
    for (const [key, value] of Object.entries(messages[lang])) {
      const text =
        typeof value === "function"
          ? (value as (...args: unknown[]) => string)("Brand", 1, "label", "reason")
          : value;
      assert.ok(typeof text === "string" && text.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test("escapeHtml neutralizes HTML special characters", () => {
  assert.equal(escapeHtml(`<b>"Tom" & 'Jerry'</b>`), "&lt;b&gt;&quot;Tom&quot; &amp; 'Jerry'&lt;/b&gt;");
});

test("welcome escapes the brand name", () => {
  assert.match(messages.en.welcome("<Evil>"), /&lt;Evil&gt;/);
  assert.doesNotMatch(messages.en.welcome("<Evil>"), /<Evil>/);
});

test("stars renders a filled and empty star bar", () => {
  assert.equal(stars(3), "⭐⭐⭐☆☆");
  assert.equal(stars(5), "⭐⭐⭐⭐⭐");
});
