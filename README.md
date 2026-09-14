# Telegram Ticket Bot

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![grammY](https://img.shields.io/badge/grammY-Telegram%20Bot-0088CC)](https://grammy.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-181717)](LICENSE)

A support desk in a box for Telegram communities and businesses. Users open a private ticket with one button, and every ticket becomes its own topic in your staff group — conversations stay organized, and closing a ticket produces a downloadable transcript.

## Demo

![Demo: opening a ticket, two-way relay, and closing with a transcript](assets/demo.gif)

## How it works

1. A user sends `/start` to the bot and presses **Open a ticket**.
2. The bot creates a dedicated forum topic in your support group, named `#id · @username`.
3. Everything the user writes is relayed into the topic; every staff reply in the topic is relayed back to the user. Media messages are relayed too.
4. A staff member runs `/close` in the topic: the user is notified, the topic is closed, and a full `.txt` transcript is posted for record keeping.

## Commands

| Command | Where | Who | Purpose |
| --- | --- | --- | --- |
| `/start` | Direct messages | Users | Show the support panel with the ticket button |
| `/close [reason]` | Ticket topic | Staff | Close the ticket, notify the user, post a transcript |
| `/tickets` | Support group | Staff | List all open tickets |

## Guarantees

- One active ticket per user — pressing the button twice is rejected.
- Only group administrators and the owner count as staff; regular members cannot close tickets or reply through the bot.
- Transcript entries record direction, sender, timestamp, and text for every relayed message.
- Webhook deployments reject requests without the correct Telegram secret token header.

## Requirements

- A bot token from [@BotFather](https://t.me/BotFather).
- A **supergroup with Topics enabled** as the support group. Convert a group to a supergroup in group settings, then enable Topics.
- The bot added to the group and promoted to **administrator** with *Manage Topics* permission.
- The group's numeric id (a negative number). A quick way to get it: add [@RawDataBot](https://t.me/RawDataBot) to the group, read the `chat.id` field, then remove it.

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Set in `.env`:

```env
BOT_TOKEN=123456789:replace_with_your_bot_token
STAFF_GROUP_ID=-1001234567890
```

The store persists to `data/store.json` (override with `STORE_PATH`). Local mode removes an active webhook before polling begins, so local and Vercel modes should be used separately.

## Deploy to Vercel

1. Import this repository into Vercel (CLI: `vercel`), or push and import from GitHub.
2. Set environment variables: `BOT_TOKEN`, `STAFF_GROUP_ID`, `WEBHOOK_SECRET` (random string of letters, digits, `_`, `-`), and `STORE_PATH=/tmp/store.json` — the Vercel filesystem is ephemeral.
3. Deploy and note the production domain, such as `https://telegram-ticket-bot.vercel.app`.
4. Set `WEBHOOK_URL` in local `.env` and run:

```powershell
npm run set-webhook
```

Telegram will deliver updates to `https://your-project.vercel.app/api/bot`. The endpoint verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `WEBHOOK_SECRET`.

> **Hosting note:** Vercel's Hobby filesystem is ephemeral, so ticket history resets between cold starts. It is fine for demos and light use. For a client production deployment, run the bot on a small VPS with the default file store (or swap `TicketStore` for a database) so history survives restarts.

## Quality checks

```powershell
npm test
npm run build
```

`npm test` covers ticket lifecycle rules, one-ticket-per-user enforcement, transcript formatting, and staff permission checks. `npm run build` validates TypeScript without emitting artifacts.

## Project structure

```text
api/bot.ts              Vercel webhook entry point
scripts/set-webhook.ts  Registers the Telegram webhook
src/bot.ts              grammY handlers: panel, relaying, close, listing
src/config.ts           Environment configuration and validation
src/permissions.ts      Staff status checks
src/tickets.ts          Ticket store: lifecycle, one-per-user rule, persistence
src/transcript.ts       Topic titles and closing transcripts
src/webhook.ts          Webhook secret validation
src/logger.ts           Structured JSON logger
src/index.ts            Local long-polling entry point
test/                   Unit tests for pure logic
```

## License

Distributed under the [MIT License](LICENSE).
