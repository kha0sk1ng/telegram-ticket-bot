export type Lang = "ru" | "en";

const russianSpeaking = new Set(["ru", "uk", "be", "kk"]);

/** Pick the user's language from Telegram's language_code (e.g. "ru", "en-US"). */
export function detectLang(code: string | undefined): Lang {
  const base = code?.toLowerCase().split("-")[0];
  return base && russianSpeaking.has(base) ? "ru" : "en";
}

/** Escape text for Telegram's HTML parse mode. */
export function escapeHtml(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function stars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "⭐".repeat(filled) + "☆".repeat(5 - filled);
}

/**
 * Every user-facing and staff-facing string. Values are plain strings or
 * functions of primitive arguments; all interpolated values are HTML-escaped.
 */
export interface Messages {
  // User side
  /** notice: the safety line under the greeting; omitted when absent. */
  welcome(brand: string, notice?: string): string;
  chooseCategory: string;
  ticketOpened(id: number, category: string): string;
  ticketOpenedWithMessages(id: number, category: string): string;
  alreadyOpen(id: number): string;
  alreadyOpenAlert: string;
  closeButton: string;
  closedByStaff(id: number, reason?: string): string;
  closedByUser(id: number): string;
  noTicket: string;
  alreadyClosed: string;
  rateQuestion: string;
  rated(rating: number): string;
  topicGone(id: number): string;
  deliveryFailed: string;
  openFailed: string;
  // Staff side
  staffCard(id: number, name: string, username: string, userId: number, lang: string, category: string): string;
  staffCloseButton: string;
  staffClosedBy(by: string, reason?: string): string;
  staffUserClosed: string;
  staffRating(rating: number): string;
  staffNoOpen: string;
  staffOpenHeader(count: number): string;
  staffCloseOnlyInTopic: string;
  staffNoTicketInTopic: string;
  staffDeliveryFailed: string;
  staffPurgeOwnerOnly: string;
  staffPurgeEmpty: string;
  staffPurgeConfirm(count: number): string;
  staffPurgeYes: string;
  staffPurgeNo: string;
  staffPurgeCancelled: string;
  staffPurgeDone(count: number, failedTopics: number): string;
}

const reasonLine = (label: string, reason?: string) => (reason ? `\n${label}: ${escapeHtml(reason)}` : "");

const noticeLines = (notice?: string) => (notice ? ["", `🛡 <i>${escapeHtml(notice)}</i>`] : []);

const ru: Messages = {
  welcome: (brand, notice) =>
    [
      `🎧 <b>${escapeHtml(brand)} — поддержка</b>`,
      "",
      "Опишите вопрос одним сообщением или выберите тему ниже. Команда ответит прямо здесь.",
      ...noticeLines(notice),
    ].join("\n"),
  chooseCategory: "Выберите тему обращения 👇",
  ticketOpened: (id, category) =>
    `✅ <b>Тикет #${escapeHtml(id)} открыт</b> · ${escapeHtml(category)}\n\nОпишите проблему — ответ придёт сюда.`,
  ticketOpenedWithMessages: (id, category) =>
    `✅ <b>Тикет #${escapeHtml(id)} открыт</b> · ${escapeHtml(category)}\n\nВаше сообщение передано команде. Ответ придёт сюда.`,
  alreadyOpen: (id) => `💬 У вас открыт тикет <b>#${escapeHtml(id)}</b>. Просто напишите сюда — команда ответит.`,
  alreadyOpenAlert: "У вас уже есть открытый тикет.",
  closeButton: "🔒 Закрыть тикет",
  closedByStaff: (id, reason) => `🔒 <b>Тикет #${escapeHtml(id)} закрыт</b> командой поддержки.${reasonLine("Причина", reason)}`,
  closedByUser: (id) => `🔒 <b>Тикет #${escapeHtml(id)} закрыт.</b>`,
  noTicket: "У вас нет открытого тикета. Напишите сообщение, чтобы создать новый.",
  alreadyClosed: "Этот тикет уже закрыт.",
  rateQuestion: "Оцените, пожалуйста, работу поддержки:",
  rated: (rating) => `Спасибо за оценку! ${stars(rating)}`,
  topicGone: (id) => `Тикет #${escapeHtml(id)} был закрыт. Напишите сообщение, чтобы открыть новый.`,
  deliveryFailed: "⚠️ Не удалось доставить сообщение. Попробуйте ещё раз.",
  openFailed: "Не удалось открыть тикет. Попробуйте позже.",
  staffCard: (id, name, username, userId, lang, category) =>
    [
      `🎫 <b>Тикет #${escapeHtml(id)}</b>`,
      "",
      `👤 <a href="tg://user?id=${escapeHtml(userId)}">${escapeHtml(name)}</a>${username ? ` · ${escapeHtml(username)}` : ""}`,
      `🆔 <code>${escapeHtml(userId)}</code>`,
      `🌐 Язык: ${escapeHtml(lang).toUpperCase()}`,
      `🏷 Тема: ${escapeHtml(category)}`,
    ].join("\n"),
  staffCloseButton: "✅ Закрыть тикет",
  staffClosedBy: (by, reason) => `🔒 Тикет закрыт: ${escapeHtml(by)}${reasonLine("Причина", reason)}`,
  staffUserClosed: "🔒 Пользователь закрыл тикет.",
  staffRating: (rating) => `Оценка пользователя: ${stars(rating)} (${escapeHtml(rating)}/5)`,
  staffNoOpen: "Открытых тикетов нет 🎉",
  staffOpenHeader: (count) => `📋 <b>Открытые тикеты: ${escapeHtml(count)}</b>`,
  staffCloseOnlyInTopic: "/close работает только внутри темы тикета.",
  staffNoTicketInTopic: "К этой теме не привязан открытый тикет.",
  staffDeliveryFailed: "⚠️ Не удалось доставить: пользователь, возможно, заблокировал бота.",
  staffPurgeOwnerOnly: "Удалить все тикеты может только владелец группы.",
  staffPurgeEmpty: "Тикетов нет, удалять нечего.",
  staffPurgeConfirm: (count) =>
    `⚠️ <b>Удалить все тикеты (${escapeHtml(count)})</b>, их темы и историю? Отменить это нельзя.`,
  staffPurgeYes: "🗑 Да, удалить",
  staffPurgeNo: "Отмена",
  staffPurgeCancelled: "Удаление отменено.",
  staffPurgeDone: (count, failedTopics) =>
    `🗑 Удалено тикетов: ${escapeHtml(count)}. Нумерация начнётся с #1.` +
    (failedTopics > 0
      ? `
⚠️ Не удалось удалить тем: ${escapeHtml(failedTopics)}. Дайте боту право «Удаление сообщений» или удалите их вручную.`
      : ""),
};

const en: Messages = {
  welcome: (brand, notice) =>
    [
      `🎧 <b>${escapeHtml(brand)} Support</b>`,
      "",
      "Describe your question in one message or pick a topic below. The team will reply right here.",
      ...noticeLines(notice),
    ].join("\n"),
  chooseCategory: "Choose a topic 👇",
  ticketOpened: (id, category) =>
    `✅ <b>Ticket #${escapeHtml(id)} opened</b> · ${escapeHtml(category)}\n\nDescribe the issue — the reply will arrive here.`,
  ticketOpenedWithMessages: (id, category) =>
    `✅ <b>Ticket #${escapeHtml(id)} opened</b> · ${escapeHtml(category)}\n\nYour message has been passed to the team. The reply will arrive here.`,
  alreadyOpen: (id) => `💬 Your ticket <b>#${escapeHtml(id)}</b> is open. Just write here and the team will reply.`,
  alreadyOpenAlert: "You already have an open ticket.",
  closeButton: "🔒 Close ticket",
  closedByStaff: (id, reason) => `🔒 <b>Ticket #${escapeHtml(id)} was closed</b> by the support team.${reasonLine("Reason", reason)}`,
  closedByUser: (id) => `🔒 <b>Ticket #${escapeHtml(id)} closed.</b>`,
  noTicket: "You have no open ticket. Send a message to create one.",
  alreadyClosed: "This ticket is already closed.",
  rateQuestion: "Please rate our support:",
  rated: (rating) => `Thanks for your feedback! ${stars(rating)}`,
  topicGone: (id) => `Ticket #${escapeHtml(id)} was closed. Send a message to open a new one.`,
  deliveryFailed: "⚠️ Your message could not be delivered. Please try again.",
  openFailed: "Could not open a ticket. Please try again later.",
  staffCard: (id, name, username, userId, lang, category) =>
    [
      `🎫 <b>Ticket #${escapeHtml(id)}</b>`,
      "",
      `👤 <a href="tg://user?id=${escapeHtml(userId)}">${escapeHtml(name)}</a>${username ? ` · ${escapeHtml(username)}` : ""}`,
      `🆔 <code>${escapeHtml(userId)}</code>`,
      `🌐 Language: ${escapeHtml(lang).toUpperCase()}`,
      `🏷 Topic: ${escapeHtml(category)}`,
    ].join("\n"),
  staffCloseButton: "✅ Close ticket",
  staffClosedBy: (by, reason) => `🔒 Ticket closed by ${escapeHtml(by)}${reasonLine("Reason", reason)}`,
  staffUserClosed: "🔒 The user closed the ticket.",
  staffRating: (rating) => `User rating: ${stars(rating)} (${escapeHtml(rating)}/5)`,
  staffNoOpen: "No open tickets 🎉",
  staffOpenHeader: (count) => `📋 <b>Open tickets: ${escapeHtml(count)}</b>`,
  staffCloseOnlyInTopic: "/close only works inside a ticket topic.",
  staffNoTicketInTopic: "No open ticket is linked to this topic.",
  staffDeliveryFailed: "⚠️ Could not deliver the message: the user may have blocked the bot.",
  staffPurgeOwnerOnly: "Only the group owner can delete all tickets.",
  staffPurgeEmpty: "There are no tickets to delete.",
  staffPurgeConfirm: (count) =>
    `⚠️ <b>Delete all tickets (${escapeHtml(count)})</b>, their topics, and history? This cannot be undone.`,
  staffPurgeYes: "🗑 Yes, delete",
  staffPurgeNo: "Cancel",
  staffPurgeCancelled: "Deletion cancelled.",
  staffPurgeDone: (count, failedTopics) =>
    `🗑 Deleted tickets: ${escapeHtml(count)}. Numbering restarts at #1.` +
    (failedTopics > 0
      ? `
⚠️ Could not delete ${escapeHtml(failedTopics)} topic(s). Give the bot the "Delete messages" right or remove them manually.`
      : ""),
};

export const messages: Record<Lang, Messages> = { ru, en };
