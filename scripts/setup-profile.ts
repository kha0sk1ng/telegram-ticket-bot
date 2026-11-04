import "dotenv/config";
import { Api } from "grammy";
import { BRAND_NAME, requireBotToken, requireStaffGroupId } from "../src/config.js";
import { logger } from "../src/logger.js";

/**
 * One-time bot profile setup: description (shown before /start), short
 * description (profile page) and command menus, in English and Russian.
 * Run again after changing BRAND_NAME.
 */
const api = new Api(requireBotToken());
const staffGroupId = requireStaffGroupId();

const profile = {
  en: {
    description: [
      `🎧 Official support desk of ${BRAND_NAME}.`,
      "",
      "Press Start, describe your question, and the team will reply right here.",
      "",
      "🛡 Admins never message you first and never ask for your seed phrase, passwords, or funds.",
    ].join("\n"),
    short: `Official ${BRAND_NAME} support. Press Start to contact the team.`,
    userCommands: [
      { command: "start", description: "Contact support" },
      { command: "close", description: "Close my ticket" },
    ],
    staffCommands: [
      { command: "tickets", description: "List open tickets" },
      { command: "close", description: "Close this ticket (inside a topic)" },
    ],
  },
  ru: {
    description: [
      `🎧 Официальная поддержка ${BRAND_NAME}.`,
      "",
      "Нажмите «Старт», опишите вопрос, и команда ответит прямо здесь.",
      "",
      "🛡 Администраторы никогда не пишут первыми и не просят seed-фразу, пароли или средства.",
    ].join("\n"),
    short: `Официальная поддержка ${BRAND_NAME}. Нажмите «Старт», чтобы написать команде.`,
    userCommands: [
      { command: "start", description: "Написать в поддержку" },
      { command: "close", description: "Закрыть мой тикет" },
    ],
    staffCommands: [
      { command: "tickets", description: "Список открытых тикетов" },
      { command: "close", description: "Закрыть тикет (внутри темы)" },
    ],
  },
};

for (const lang of ["en", "ru"] as const) {
  const texts = profile[lang];
  // English is the fallback for every language without its own texts.
  const language_code = lang === "en" ? undefined : lang;
  await api.setMyDescription(texts.description, { language_code });
  await api.setMyShortDescription(texts.short, { language_code });
  await api.setMyCommands(texts.userCommands, { scope: { type: "all_private_chats" }, language_code });
  await api.setMyCommands(texts.staffCommands, {
    scope: { type: "chat_administrators", chat_id: staffGroupId },
    language_code,
  });
}

logger.info("profile_configured", { brand: BRAND_NAME });
console.info(`Bot profile configured for "${BRAND_NAME}" (en + ru).`);
