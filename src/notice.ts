import type { Lang } from "./i18n.js";

/** Safety line under the welcome message, per language; null means none. */
export type Notice = Record<Lang, string> | null;

/** Default for crypto projects: fake "admins" in DMs are the most common scam. */
export const DEFAULT_NOTICE: Record<Lang, string> = {
  en: "Admins never message you first and never ask for your seed phrase, passwords, codes, or a transfer of funds.",
  ru: "Администраторы никогда не пишут первыми и не просят seed-фразу, пароли, коды или перевод средств.",
};

/**
 * Parse the SCAM_NOTICE setting: blank means the default, "off" or "none"
 * disables it, anything else is "English text | Russian text" or one text
 * for both languages. Plain text only: it is HTML-escaped when shown.
 */
export function parseNotice(raw: string | undefined): Notice {
  const value = raw?.trim() ?? "";
  if (!value) {
    return DEFAULT_NOTICE;
  }
  if (/^(off|none)$/i.test(value)) {
    return null;
  }
  const [en = "", ru = ""] = value.split("|").map((part) => part.trim());
  return { en: en || ru, ru: ru || en };
}
