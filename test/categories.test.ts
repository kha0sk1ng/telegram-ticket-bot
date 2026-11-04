import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CATEGORIES, findCategory, parseCategories } from "../src/categories.js";

test("missing or blank config falls back to the default categories", () => {
  assert.deepEqual(parseCategories(undefined), DEFAULT_CATEGORIES);
  assert.deepEqual(parseCategories("   "), DEFAULT_CATEGORIES);
  assert.equal(DEFAULT_CATEGORIES.length, 4);
  for (const category of DEFAULT_CATEGORIES) {
    assert.ok(category.label.en && category.label.ru);
  }
});

test("parses 'EN | RU' pairs separated by semicolons", () => {
  const categories = parseCategories("💰 Deposit | 💰 Депозит; 🐞 Bug");
  assert.equal(categories.length, 2);
  assert.deepEqual(categories[0], { id: "c0", label: { en: "💰 Deposit", ru: "💰 Депозит" } });
  // A single label is used for both languages.
  assert.deepEqual(categories[1], { id: "c1", label: { en: "🐞 Bug", ru: "🐞 Bug" } });
});

test("skips empty items and trims whitespace", () => {
  const categories = parseCategories(" ; A |  Б ;; ");
  assert.equal(categories.length, 1);
  assert.deepEqual(categories[0].label, { en: "A", ru: "Б" });
});

test("caps the number of categories at 8 to keep the keyboard usable", () => {
  const raw = Array.from({ length: 12 }, (_, i) => `Cat ${i}`).join(";");
  assert.equal(parseCategories(raw).length, 8);
});

test("findCategory looks up by id", () => {
  assert.equal(findCategory(DEFAULT_CATEGORIES, "c1")?.id, "c1");
  assert.equal(findCategory(DEFAULT_CATEGORIES, "nope"), undefined);
});
