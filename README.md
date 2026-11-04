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
2. Create a free Redis database at [Upstash](https://upstash.com) and copy its REST URL and token.
3. Set environment variables: `BOT_TOKEN`, `STAFF_GROUP_ID`, `WEBHOOK_SECRET` (random string of letters, digits, `_`, `-`), `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Optionally set `STORE_KEY` to host several bots in one database.
4. Deploy and note the production domain, such as `https://telegram-ticket-bot.vercel.app`.
5. Set `WEBHOOK_URL` in local `.env` and run:

```powershell
npm run set-webhook
```

Telegram will deliver updates to `https://your-project.vercel.app/api/bot`. The endpoint verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `WEBHOOK_SECRET`.

> **Storage note:** Vercel's filesystem is ephemeral, so the bot stores tickets in Upstash Redis there. Each update reloads the latest state, so separate serverless instances stay in sync. Without Upstash variables the bot falls back to a local JSON file (`STORE_PATH`), which suits long polling on a VPS.

## Quality checks

```powershell
npm test
npm run build
```

`npm test` covers ticket lifecycle rules, one-ticket-per-user enforcement, transcript formatting, staff permission checks, and storage backends (file, Upstash via a mocked fetch, reload across instances). `npm run build` validates TypeScript without emitting artifacts.

## Project structure

```text
api/bot.ts              Vercel webhook entry point
scripts/set-webhook.ts  Registers the Telegram webhook
src/bot.ts              grammY handlers: panel, relaying, close, listing
src/config.ts           Environment configuration and validation
src/permissions.ts      Staff status checks
src/tickets.ts          Ticket store: lifecycle, one-per-user rule, persistence
src/storage.ts          Storage backends: JSON file, Upstash Redis, in-memory
src/transcript.ts       Topic titles and closing transcripts
src/webhook.ts          Webhook secret validation
src/logger.ts           Structured JSON logger
src/index.ts            Local long-polling entry point
test/                   Unit tests for pure logic
```

## License

Distributed under the [MIT License](LICENSE).
