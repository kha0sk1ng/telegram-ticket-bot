import "dotenv/config";
import { parseCategories, type Category } from "./categories.js";
import type { Lang } from "./i18n.js";
import { parseNotice, type Notice } from "./notice.js";
import { FileBackend, UpstashBackend, type StorageBackend } from "./storage.js";

/** Per-client branding: shown in the welcome message. */
export const BRAND_NAME = process.env.BRAND_NAME?.trim() || "Support";
/** Ticket topics offered to users; see parseCategories for the format. */
export const CATEGORIES: Category[] = parseCategories(process.env.CATEGORIES);
/** Language of staff-facing messages in the support group. */
export const STAFF_LANG: Lang = process.env.STAFF_LANG?.trim().toLowerCase() === "ru" ? "ru" : "en";
/** Safety line in the welcome message and bot profile; see parseNotice for the format. */
export const SCAM_NOTICE: Notice = parseNotice(process.env.SCAM_NOTICE);

export const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
export const STAFF_GROUP_ID = Number(process.env.STAFF_GROUP_ID);
export const STORE_PATH = process.env.STORE_PATH?.trim() || "data/store.json";
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
// One Redis database can serve several client bots when each uses its own key.
const STORE_KEY = process.env.STORE_KEY?.trim() || "ticket-bot:store";

/** Upstash Redis when its credentials are set, otherwise a local JSON file. */
export function createStorage(): StorageBackend {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    return new UpstashBackend(UPSTASH_URL, UPSTASH_TOKEN, STORE_KEY);
  }
  if (UPSTASH_URL || UPSTASH_TOKEN) {
    throw new Error("Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither.");
  }
  return new FileBackend(STORE_PATH);
}

/** Branding and language options shared by every entry point. */
export function botOptions() {
  return { brand: BRAND_NAME, categories: CATEGORIES, staffLang: STAFF_LANG, notice: SCAM_NOTICE };
}

export function storageKind(): "upstash" | "file" {
  return UPSTASH_URL && UPSTASH_TOKEN ? "upstash" : "file";
}

export function requireBotToken(): string {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing. Copy .env.example to .env and add a token from @BotFather.");
  }
  return BOT_TOKEN;
}

export function requireStaffGroupId(): number {
  if (!Number.isInteger(STAFF_GROUP_ID) || STAFF_GROUP_ID > -1) {
    throw new Error("STAFF_GROUP_ID must be the numeric id of the support group (a negative number).");
  }
  return STAFF_GROUP_ID;
}
