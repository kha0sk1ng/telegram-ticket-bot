export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET?.trim();

export function requireWebhookSecret(): string {
  if (!WEBHOOK_SECRET || !/^[A-Za-z0-9_-]{1,256}$/.test(WEBHOOK_SECRET)) {
    throw new Error("WEBHOOK_SECRET must contain 1 to 256 letters, digits, underscores, or hyphens.");
  }
  return WEBHOOK_SECRET;
}
