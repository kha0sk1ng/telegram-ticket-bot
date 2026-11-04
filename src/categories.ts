import type { Lang } from "./i18n.js";

export interface Category {
  /** Stable id used in callback data: "c0", "c1", ... by position in the config. */
  id: string;
  label: Record<Lang, string>;
}

const MAX_CATEGORIES = 8;

/** Default topics for a crypto project's support desk. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "c0", label: { en: "💰 Deposit", ru: "💰 Депозит" } },
  { id: "c1", label: { en: "💸 Withdrawal", ru: "💸 Вывод" } },
  { id: "c2", label: { en: "🐞 Bug report", ru: "🐞 Ошибка" } },
  { id: "c3", label: { en: "❓ Other", ru: "❓ Другое" } },
];

/**
 * Parse the CATEGORIES setting: items separated by ";", each "EN label | RU label"
 * or a single label used for both languages. Blank config means the defaults.
 */
export function parseCategories(raw: string | undefined): Category[] {
  const items = (raw ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_CATEGORIES);

  if (items.length === 0) {
    return DEFAULT_CATEGORIES;
  }

  const labels = items
    .map((item) => item.split("|").map((part) => part.trim()))
    .filter(([en, ru]) => en || ru);

  return labels.map(([en, ru], index) => ({
    id: `c${index}`,
    label: { en: en || ru, ru: ru || en },
  }));
}

export function findCategory(categories: Category[], id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}
