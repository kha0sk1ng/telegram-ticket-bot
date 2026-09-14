import { Bot, Context, InputFile } from "grammy";
import type { TicketStore } from "./tickets.js";
import { formatTranscript, ticketTopicTitle } from "./transcript.js";
import { isStaff } from "./permissions.js";
import { logger } from "./logger.js";

const openTicketButton = {
  reply_markup: {
    inline_keyboard: [[{ text: "Open a ticket", callback_data: "open_ticket" }]],
  },
};

const welcomeText = [
  "Welcome to the support desk.",
  "Press the button below and a private ticket will be created for your conversation with the team.",
].join("\n");

export interface BotDeps {
  token: string;
  staffGroupId: number;
  store: TicketStore;
}

export function createBot({ token, staffGroupId, store }: BotDeps): Bot {
  const bot = new Bot(token);

  // User entry point: the support panel in direct messages.
  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return;
    }
    const active = store.findByUser(ctx.from.id);
    if (active) {
      await ctx.reply(`You already have an open ticket #${active.id}. Send your message here and the team will reply.`);
      return;
    }
    await ctx.reply(welcomeText, openTicketButton);
  });

  bot.callbackQuery("open_ticket", async (ctx) => {
    if (!ctx.from) {
      return;
    }
    if (store.findByUser(ctx.from.id)) {
      await ctx.answerCallbackQuery({ text: "You already have an open ticket.", show_alert: true });
      return;
    }

    const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const title = ticketTopicTitle(store.peekNextId(), userName);
    try {
      const topic = await ctx.api.createForumTopic(staffGroupId, title);
      const ticket = store.open(ctx.from.id, userName, topic.message_thread_id);
      await store.persist();

      await ctx.api.sendMessage(
        staffGroupId,
        `Ticket #${ticket.id} opened by ${userName} (user id ${ticket.userId}).`,
        { message_thread_id: ticket.topicId },
      );
      await ctx.answerCallbackQuery();
      await ctx.reply(`Ticket #${ticket.id} is open. Send your message here and the team will reply.`);
      logger.info("ticket_opened", { ticketId: ticket.id, userId: ticket.userId });
    } catch (error) {
      logger.error("ticket_open_failed", { message: error instanceof Error ? error.message : String(error) });
      await ctx.answerCallbackQuery({ text: "Could not open a ticket. Please try again later.", show_alert: true });
    }
  });

  // Group commands must be registered before the catch-all message handler.
  bot.command("close", async (ctx) => {
    if (ctx.chat?.id !== staffGroupId || !ctx.from) {
      return;
    }

    const threadId = ctx.message?.message_thread_id;
    if (!threadId) {
      await ctx.reply("/close only works inside a ticket topic.");
      return;
    }

    const ticket = store.findByTopic(threadId);
    if (!ticket) {
      await ctx.reply("No open ticket is linked to this topic.");
      return;
    }

    const member = await ctx.api.getChatMember(staffGroupId, ctx.from.id);
    if (!isStaff(member.status)) {
      return;
    }

    const reason = ctx.match.trim() || undefined;
    store.close(ticket.id, reason);
    await store.persist();

    const transcript = formatTranscript(ticket);
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(transcript, "utf8"), `ticket-${ticket.id}.txt`),
      { message_thread_id: threadId },
    );

    await ctx.api
      .sendMessage(
        ticket.userId,
        `Your ticket #${ticket.id} has been closed.${reason ? ` Reason: ${reason}` : ""}`,
      )
      .catch((error) => {
        logger.warn("close_notification_failed", {
          ticketId: ticket.id,
          message: error instanceof Error ? error.message : String(error),
        });
      });

    await ctx.api.closeForumTopic(staffGroupId, threadId);
    logger.info("ticket_closed", { ticketId: ticket.id });
  });

  bot.command("tickets", async (ctx) => {
    if (ctx.chat?.id !== staffGroupId || !ctx.from) {
      return;
    }
    const member = await ctx.api.getChatMember(staffGroupId, ctx.from.id);
    if (!isStaff(member.status)) {
      return;
    }

    const open = store.openTickets;
    if (open.length === 0) {
      await ctx.reply("No open tickets.");
      return;
    }

    const lines = open.map(
      (ticket) => `#${ticket.id} — ${ticket.userName} (user id ${ticket.userId}), opened ${ticket.createdAt}`,
    );
    await ctx.reply(`Open tickets (${open.length}):\n${lines.join("\n")}`);
  });

  // Staff replies inside a ticket topic are relayed to the user.
  bot.on("message", async (ctx) => {
    if (ctx.chat.type === "private") {
      if (ctx.msg.text?.startsWith("/")) {
        return;
      }
      await relayUserMessage(ctx);
      return;
    }

    if (ctx.chat.id !== staffGroupId) {
      return;
    }
    await relayStaffMessage(ctx);
  });

  async function relayUserMessage(ctx: Context): Promise<void> {
    if (!ctx.from || !ctx.msg) {
      return;
    }
    const ticket = store.findByUser(ctx.from.id);
    if (!ticket) {
      await ctx.reply("You have no open ticket. Send /start to create one.");
      return;
    }

    try {
      await ctx.copyMessage(staffGroupId, { message_thread_id: ticket.topicId });
    } catch (error) {
      logger.error("user_message_relay_failed", {
        ticketId: ticket.id,
        message: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply("Your message could not be delivered. Please try again.");
      return;
    }

    store.logMessage(ticket.id, "in", ticket.userName, ctx.msg.text ?? ctx.msg.caption);
  }

  async function relayStaffMessage(ctx: Context): Promise<void> {
    if (!ctx.from || !ctx.message) {
      return;
    }
    const message = ctx.message;
    const threadId = message.message_thread_id;
    if (!threadId || message.text?.startsWith("/")) {
      return;
    }

    const ticket = store.findByTopic(threadId);
    if (!ticket) {
      return;
    }

    const member = await ctx.api.getChatMember(staffGroupId, ctx.from.id);
    if (!isStaff(member.status)) {
      return;
    }

    const staffName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    try {
      await ctx.copyMessage(ticket.userId, {});
    } catch (error) {
      logger.warn("staff_message_relay_failed", {
        ticketId: ticket.id,
        message: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply("Could not deliver the message: the user may have blocked the bot.", {
        message_thread_id: threadId,
      });
      return;
    }

    store.logMessage(ticket.id, "out", staffName, message.text ?? message.caption);
  }

  bot.catch((error) => {
    logger.error("unhandled_update_error", {
      message: error.error instanceof Error ? error.error.message : String(error.error),
    });
  });

  return bot;
}
