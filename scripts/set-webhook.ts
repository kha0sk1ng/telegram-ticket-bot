import "dotenv/config";
import { createBot } from "../src/bot.js";
import { requireBotToken, requireStaffGroupId } from "../src/config.js";
import { TicketStore } from "../src/tickets.js";
import { requireWebhookSecret } from "../src/webhook.js";
import { logger } from "../src/logger.js";

const webhookUrl = process.env.WEBHOOK_URL?.replace(/\/$/, "");
if (!webhookUrl) {
  throw new Error("WEBHOOK_URL is unset. Set it to your Vercel deployment URL.");
}

// Registering a webhook only needs bot.api; an in-memory store avoids touching real data.
const store = new TicketStore();
const bot = createBot({ token: requireBotToken(), staffGroupId: requireStaffGroupId(), store });

const endpoint = `${webhookUrl}/api/bot`;
await bot.api.setWebhook(endpoint, {
  allowed_updates: ["message", "callback_query"],
  secret_token: requireWebhookSecret(),
});
logger.info("webhook_registered", { webhookUrl: endpoint });
console.info(`Webhook set to ${endpoint}`);
