import "dotenv/config";

export const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
export const STAFF_GROUP_ID = Number(process.env.STAFF_GROUP_ID);
export const STORE_PATH = process.env.STORE_PATH?.trim() || "data/store.json";

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
