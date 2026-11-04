import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";
import { botOptions, createStorage, requireBotToken, requireStaffGroupId } from "../src/config.js";
import { TicketStore } from "../src/tickets.js";
import { requireWebhookSecret } from "../src/webhook.js";

const store = await TicketStore.load(createStorage());
const bot = createBot({ token: requireBotToken(), staffGroupId: requireStaffGroupId(), store, ...botOptions() });

export default webhookCallback(bot, "https", {
  onTimeout: "return",
  secretToken: requireWebhookSecret(),
  timeoutMilliseconds: 8_500,
});
