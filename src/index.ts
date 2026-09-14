import { createBot } from "./bot.js";
import { BOT_TOKEN, requireBotToken, requireStaffGroupId, STORE_PATH } from "./config.js";
import { TicketStore } from "./tickets.js";
import { logger } from "./logger.js";

const store = await TicketStore.load(STORE_PATH);
const bot = createBot({ token: requireBotToken(), staffGroupId: requireStaffGroupId(), store });

// Local long polling must not fight with an active webhook.
await bot.api.deleteWebhook({ drop_pending_updates: true });

logger.info("bot_started", { mode: "long_polling", tokenPresent: Boolean(BOT_TOKEN) });
console.info("Ticket bot started with long polling. Press Ctrl+C to stop.");

await bot.start({
  onStart: () => logger.info("polling_started"),
});
