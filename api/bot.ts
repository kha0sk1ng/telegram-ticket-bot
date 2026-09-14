import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";
import { requireBotToken, requireStaffGroupId, STORE_PATH } from "../src/config.js";
import { TicketStore } from "../src/tickets.js";
import { requireWebhookSecret } from "../src/webhook.js";

const store = await TicketStore.load(STORE_PATH);
const bot = createBot({ token: requireBotToken(), staffGroupId: requireStaffGroupId(), store });

export default webhookCallback(bot, "https", {
  onTimeout: "return",
  secretToken: requireWebhookSecret(),
  timeoutMilliseconds: 8_500,
});
