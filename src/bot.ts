import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { callbackData, parseCallback } from "./callbacks.js";
import { DEFAULT_CATEGORIES, findCategory, type Category } from "./categories.js";
import { detectLang, escapeHtml, messages, type Lang } from "./i18n.js";
import type { Ticket, TicketStore } from "./tickets.js";
import { formatTranscript, shortAge, ticketTopicTitle } from "./transcript.js";
import { isStaff } from "./permissions.js";
import { logger } from "./logger.js";

export interface BotDeps {
  token: string;
  staffGroupId: number;
  store: TicketStore;
  /** Project name shown in the welcome message. */
  brand?: string;
  categories?: Category[];
  /** Language of messages posted in the support group. */
  staffLang?: Lang;
}

const HTML = { parse_mode: "HTML" } as const;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const displayName = (from: { username?: string; first_name: string }) =>
  from.username ? `@${from.username}` : from.first_name;

export function createBot({
  token,
  staffGroupId,
  store,
  brand = "Support",
  categories = DEFAULT_CATEGORIES,
  staffLang = "en",
}: BotDeps): Bot {
  const bot = new Bot(token);
  const staff = messages[staffLang];
  // Guards against double taps on a category button within one instance.
  const opening = new Set<number>();

  const userLang = (ctx: Context): Lang => detectLang(ctx.from?.language_code);

  const categoryKeyboard = (lang: Lang) => {
    const keyboard = new InlineKeyboard();
    categories.forEach((category, index) => {
      keyboard.text(category.label[lang], callbackData({ kind: "category", categoryId: category.id }));
      if (index % 2 === 1) {
        keyboard.row();
      }
    });
    return keyboard;
  };

  const userCloseKeyboard = (lang: Lang, ticketId: number) =>
    new InlineKeyboard().text(messages[lang].closeButton, callbackData({ kind: "userClose", ticketId }));

  const staffCloseKeyboard = (ticketId: number) =>
    new InlineKeyboard().text(staff.staffCloseButton, callbackData({ kind: "staffClose", ticketId }));

  const rateKeyboard = (ticketId: number) => {
    const keyboard = new InlineKeyboard();
    for (let rating = 1; rating <= 5; rating += 1) {
      keyboard.text(`${rating}⭐`, callbackData({ kind: "rate", ticketId, rating }));
    }
    return keyboard;
  };

  /** Quiet delivery receipt: a 👀 reaction on the user's message. */
  async function markDelivered(chatId: number, messageId: number): Promise<void> {
    await bot.api
      .setMessageReaction(chatId, messageId, [{ type: "emoji", emoji: "👀" }])
      .catch((error) => logger.warn("reaction_failed", { message: errorMessage(error) }));
  }

  async function isTopicAlive(topicId: number): Promise<boolean> {
    // The Bot API cannot fetch a topic by id directly, and grammY does not
    // type the newer getForumTopicIconEmoji method, so probe it over HTTP:
    // it returns 404 when the topic no longer exists. (editForumTopic with
    // no fields is a no-op and succeeds even for deleted topics.)
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getForumTopicIconEmoji?chat_id=${staffGroupId}&message_thread_id=${topicId}`,
        { signal: AbortSignal.timeout(5000) },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async function isStaffMember(userId: number): Promise<boolean> {
    const member = await bot.api.getChatMember(staffGroupId, userId);
    return isStaff(member.status);
  }

  /**
   * Close a ticket from either side: post the transcript in the topic,
   * tell the user and ask for a rating, then close the topic.
   */
  async function closeTicket(ticket: Ticket, closedBy: { user: true } | { staff: string; reason?: string }) {
    const reason = "staff" in closedBy ? closedBy.reason : undefined;
    store.close(ticket.id, reason ?? ("user" in closedBy ? "closed by user" : undefined));
    await store.persist();

    const caption = "staff" in closedBy ? staff.staffClosedBy(closedBy.staff, reason) : staff.staffUserClosed;
    await bot.api
      .sendDocument(staffGroupId, new InputFile(Buffer.from(formatTranscript(ticket), "utf8"), `ticket-${ticket.id}.txt`), {
        message_thread_id: ticket.topicId,
        caption,
        ...HTML,
      })
      .catch((error) => logger.warn("transcript_failed", { ticketId: ticket.id, message: errorMessage(error) }));

    const lang = ticket.lang ?? "en";
    const t = messages[lang];
    const closedText = "staff" in closedBy ? t.closedByStaff(ticket.id, reason) : t.closedByUser(ticket.id);
    await bot.api
      .sendMessage(ticket.userId, `${closedText}\n\n${t.rateQuestion}`, { ...HTML, reply_markup: rateKeyboard(ticket.id) })
      .catch((error) => logger.warn("close_notification_failed", { ticketId: ticket.id, message: errorMessage(error) }));

    await bot.api
      .closeForumTopic(staffGroupId, ticket.topicId)
      .catch((error) => logger.warn("topic_close_failed", { ticketId: ticket.id, message: errorMessage(error) }));

    logger.info("ticket_closed", { ticketId: ticket.id, by: "user" in closedBy ? "user" : "staff" });
  }

  // Serverless instances do not share memory: always start from the latest state.
  bot.use(async (_ctx, next) => {
    await store.reload();
    await next();
  });

  // --- User side ---------------------------------------------------------

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return;
    }
    const lang = userLang(ctx);
    const t = messages[lang];

    const active = store.findByUser(ctx.from.id);
    if (active) {
      // Staff may have deleted the forum topic manually. Detect that here
      // so the user is never stuck with a dead ticket.
      if (await isTopicAlive(active.topicId)) {
        await ctx.reply(t.alreadyOpen(active.id), { ...HTML, reply_markup: userCloseKeyboard(lang, active.id) });
        return;
      }
      store.close(active.id, "topic was deleted or closed");
      await store.persist();
      await ctx.reply(t.topicGone(active.id), HTML);
    }

    await ctx.reply(t.welcome(brand), { ...HTML, reply_markup: categoryKeyboard(lang) });
  });

  async function openTicket(ctx: Context, category: Category): Promise<void> {
    const from = ctx.from!;
    const lang = userLang(ctx);
    const t = messages[lang];

    if (store.findByUser(from.id) || opening.has(from.id)) {
      await ctx.answerCallbackQuery({ text: t.alreadyOpenAlert, show_alert: true });
      return;
    }

    opening.add(from.id);
    try {
      const userName = displayName(from);
      const staffLabel = category.label[staffLang];
      const topic = await ctx.api.createForumTopic(
        staffGroupId,
        ticketTopicTitle(store.peekNextId(), userName, staffLabel),
      );
      const ticket = store.open(from.id, userName, topic.message_thread_id, { category: staffLabel, lang });
      const pending = store.takePending(from.id);
      await store.persist();

      await ctx.api.sendMessage(
        staffGroupId,
        staff.staffCard(ticket.id, from.first_name, from.username ? `@${from.username}` : "", from.id, lang, staffLabel),
        { message_thread_id: ticket.topicId, ...HTML, reply_markup: staffCloseKeyboard(ticket.id) },
      );

      // Messages written before the category was chosen go into the ticket too.
      if (pending.length > 0) {
        await ctx.api.copyMessages(
          staffGroupId,
          from.id,
          pending.map((message) => message.messageId),
          { message_thread_id: ticket.topicId },
        );
        for (const message of pending) {
          store.logMessage(ticket.id, "in", userName, message.text);
        }
        await store.persist();
        await Promise.all(pending.map((message) => markDelivered(from.id, message.messageId)));
      }

      await ctx.answerCallbackQuery();
      // Drop the category buttons so they cannot be pressed again.
      await ctx.editMessageReplyMarkup().catch(() => undefined);
      const opened = pending.length > 0 ? t.ticketOpenedWithMessages : t.ticketOpened;
      await ctx.reply(opened(ticket.id, category.label[lang]), {
        ...HTML,
        reply_markup: userCloseKeyboard(lang, ticket.id),
      });
      logger.info("ticket_opened", { ticketId: ticket.id, userId: ticket.userId, category: category.id });
    } catch (error) {
      logger.error("ticket_open_failed", { message: errorMessage(error) });
      await ctx.answerCallbackQuery({ text: t.openFailed, show_alert: true }).catch(() => undefined);
    } finally {
      opening.delete(from.id);
    }
  }

  bot.on("callback_query:data", async (ctx) => {
    const action = parseCallback(ctx.callbackQuery.data);
    const t = messages[userLang(ctx)];

    // Buttons from the previous version: show the category picker instead.
    if (ctx.callbackQuery.data === "open_ticket") {
      await ctx.answerCallbackQuery();
      await ctx.reply(t.chooseCategory, { reply_markup: categoryKeyboard(userLang(ctx)) });
      return;
    }
    if (!action) {
      await ctx.answerCallbackQuery();
      return;
    }

    switch (action.kind) {
      case "category": {
        const category = findCategory(categories, action.categoryId);
        if (!category) {
          // The client changed CATEGORIES after this keyboard was sent.
          await ctx.answerCallbackQuery();
          await ctx.reply(t.chooseCategory, { reply_markup: categoryKeyboard(userLang(ctx)) });
          return;
        }
        await openTicket(ctx, category);
        return;
      }

      case "userClose": {
        const ticket = store.findById(action.ticketId);
        if (!ticket || ticket.userId !== ctx.from.id) {
          await ctx.answerCallbackQuery();
          return;
        }
        await ctx.editMessageReplyMarkup().catch(() => undefined);
        if (ticket.status !== "open") {
          await ctx.answerCallbackQuery({ text: t.alreadyClosed });
          return;
        }
        await ctx.answerCallbackQuery();
        await closeTicket(ticket, { user: true });
        return;
      }

      case "staffClose": {
        if (ctx.chat?.id !== staffGroupId || !(await isStaffMember(ctx.from.id))) {
          await ctx.answerCallbackQuery();
          return;
        }
        const ticket = store.findById(action.ticketId);
        await ctx.editMessageReplyMarkup().catch(() => undefined);
        if (!ticket || ticket.status !== "open") {
          await ctx.answerCallbackQuery({ text: staff.alreadyClosed });
          return;
        }
        await ctx.answerCallbackQuery();
        await closeTicket(ticket, { staff: displayName(ctx.from) });
        return;
      }

      case "rate": {
        const ticket = store.rate(action.ticketId, ctx.from.id, action.rating);
        await ctx.editMessageReplyMarkup().catch(() => undefined);
        if (!ticket) {
          await ctx.answerCallbackQuery();
          return;
        }
        await store.persist();
        const lang = ticket.lang ?? userLang(ctx);
        await ctx.answerCallbackQuery();
        await ctx.reply(messages[lang].rated(action.rating));
        await ctx.api
          .sendMessage(staffGroupId, staff.staffRating(action.rating), { message_thread_id: ticket.topicId })
          .catch((error) => logger.warn("rating_post_failed", { ticketId: ticket.id, message: errorMessage(error) }));
        logger.info("ticket_rated", { ticketId: ticket.id, rating: action.rating });
        return;
      }
    }
  });

  // --- Commands that work on both sides --------------------------------------

  // Group commands must be registered before the catch-all message handler.
  bot.command("close", async (ctx) => {
    if (!ctx.from) {
      return;
    }

    // A user closing their own ticket from the private chat.
    if (ctx.chat.type === "private") {
      const t = messages[userLang(ctx)];
      const ticket = store.findByUser(ctx.from.id);
      if (!ticket) {
        await ctx.reply(t.noTicket);
        return;
      }
      await closeTicket(ticket, { user: true });
      return;
    }

    if (ctx.chat.id !== staffGroupId) {
      return;
    }
    const threadId = ctx.message?.message_thread_id;
    if (!threadId) {
      await ctx.reply(staff.staffCloseOnlyInTopic);
      return;
    }
    const ticket = store.findByTopic(threadId);
    if (!ticket) {
      await ctx.reply(staff.staffNoTicketInTopic, { message_thread_id: threadId });
      return;
    }
    if (!(await isStaffMember(ctx.from.id))) {
      return;
    }
    await closeTicket(ticket, { staff: displayName(ctx.from), reason: ctx.match.trim() || undefined });
  });

  bot.command("tickets", async (ctx) => {
    if (ctx.chat?.id !== staffGroupId || !ctx.from || !(await isStaffMember(ctx.from.id))) {
      return;
    }

    const open = store.openTickets;
    if (open.length === 0) {
      await ctx.reply(staff.staffNoOpen, { message_thread_id: ctx.message?.message_thread_id });
      return;
    }

    const now = new Date();
    const lines = open.map((ticket) =>
      [
        `<b>#${ticket.id}</b>`,
        ticket.category ? escapeHtml(ticket.category) : undefined,
        `<a href="tg://user?id=${ticket.userId}">${escapeHtml(ticket.userName)}</a>`,
        `🕒 ${shortAge(ticket.createdAt, now)}`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    await ctx.reply(`${staff.staffOpenHeader(open.length)}\n\n${lines.join("\n")}`, {
      ...HTML,
      message_thread_id: ctx.message?.message_thread_id,
    });
  });

  // --- Message relaying ---------------------------------------------------

  // Only text and media are relayed: service messages such as
  // forum_topic_created cannot be copied and are not conversations.
  bot.on(["message:text", "message:media"], async (ctx) => {
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
    const lang = userLang(ctx);
    const t = messages[lang];
    const text = ctx.msg.text ?? ctx.msg.caption;

    const ticket = store.findByUser(ctx.from.id);
    if (!ticket) {
      // No ticket yet: keep the message and ask for a category once.
      const queued = store.addPending(ctx.from.id, ctx.msg.message_id, text);
      await store.persist();
      if (queued === 1) {
        await ctx.reply(t.chooseCategory, { reply_markup: categoryKeyboard(lang) });
      }
      return;
    }

    try {
      await ctx.copyMessage(staffGroupId, { message_thread_id: ticket.topicId });
    } catch (error) {
      const message = errorMessage(error);
      logger.error("user_message_relay_failed", { ticketId: ticket.id, message });
      // The forum topic may have been deleted by staff manually. Then the
      // ticket can never be delivered to, so close it; the user's next
      // message starts a fresh one.
      if (/message thread not found|topic.*not found|TOPIC_CLOSED|thread not found/i.test(message)) {
        store.close(ticket.id, "topic was deleted");
        await store.persist();
        await ctx.reply(t.topicGone(ticket.id));
        return;
      }
      await ctx.reply(t.deliveryFailed);
      return;
    }

    store.logMessage(ticket.id, "in", ticket.userName, text);
    await store.persist();
    await markDelivered(ctx.chat!.id, ctx.msg.message_id);
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
    if (!ticket || !(await isStaffMember(ctx.from.id))) {
      return;
    }

    try {
      await ctx.copyMessage(ticket.userId, {});
    } catch (error) {
      logger.warn("staff_message_relay_failed", { ticketId: ticket.id, message: errorMessage(error) });
      await ctx.reply(staff.staffDeliveryFailed, { message_thread_id: threadId });
      return;
    }

    store.logMessage(ticket.id, "out", displayName(ctx.from), message.text ?? message.caption);
    await store.persist();
  }

  bot.catch((error) => {
    logger.error("unhandled_update_error", { message: errorMessage(error.error) });
  });

  return bot;
}
