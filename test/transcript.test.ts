import assert from "node:assert/strict";
import test from "node:test";
import { formatOpenTicketLine, formatTranscript, shortAge, ticketTopicTitle } from "../src/transcript.js";
import type { Ticket } from "../src/tickets.js";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 7,
    userId: 42,
    userName: "@alice",
    topicId: 100,
    status: "open",
    createdAt: "2026-09-14T10:00:00.000Z",
    messages: [
      { direction: "in", from: "@alice", at: "2026-09-14T10:01:00.000Z", text: "hello" },
      { direction: "out", from: "@staff", at: "2026-09-14T10:02:00.000Z", text: "hi" },
      { direction: "in", from: "@alice", at: "2026-09-14T10:03:00.000Z" },
    ],
    ...overrides,
  };
}

test("ticketTopicTitle includes id and user name", () => {
  assert.equal(ticketTopicTitle(12, "@alice"), "#12 · @alice");
});

test("ticketTopicTitle includes the category when given", () => {
  assert.equal(ticketTopicTitle(12, "@alice", "💸 Withdrawal"), "#12 · 💸 Withdrawal · @alice");
});

test("ticketTopicTitle stays within Telegram's 128 character limit", () => {
  const title = ticketTopicTitle(12, "x".repeat(200), "category");
  assert.ok([...title].length <= 128);
  assert.ok(title.startsWith("#12 · category · "));
});

test("shortAge renders compact elapsed time", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");
  assert.equal(shortAge("2026-09-14T11:59:30.000Z", now), "<1m");
  assert.equal(shortAge("2026-09-14T11:15:00.000Z", now), "45m");
  assert.equal(shortAge("2026-09-14T09:00:00.000Z", now), "3h");
  assert.equal(shortAge("2026-09-12T12:00:00.000Z", now), "2d");
});

test("formatTranscript includes category and rating when present", () => {
  const text = formatTranscript(makeTicket({ category: "🐞 Bug", rating: 4 }));
  assert.match(text, /Category: 🐞 Bug/);
  assert.match(text, /Rating: 4\/5/);
});

test("formatTranscript renders header and both directions", () => {
  const text = formatTranscript(makeTicket());
  assert.match(text, /Ticket #7/);
  assert.match(text, /User: @alice \(id 42\)/);
  assert.match(text, /Opened: 2026-09-14T10:00:00\.000Z/);
  assert.match(text, /user -> staff \| @alice: hello/);
  assert.match(text, /staff -> user \| @staff: hi/);
  assert.match(text, /user -> staff \| @alice: \(media message\)/);
});

test("formatTranscript includes close metadata when present", () => {
  const text = formatTranscript(
    makeTicket({ status: "closed", closedAt: "2026-09-14T11:00:00.000Z", closeReason: "resolved" }),
  );
  assert.match(text, /Closed: 2026-09-14T11:00:00\.000Z/);
  assert.match(text, /Reason: resolved/);
});

test("formatTranscript handles a ticket without messages", () => {
  const text = formatTranscript(makeTicket({ messages: [] }));
  assert.match(text, /No messages were exchanged\./);
});

test("formatOpenTicketLine escapes every HTML-sensitive value", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");
  const line = formatOpenTicketLine(
    {
      id: 7,
      userId: 42,
      userName: "<b>Eve & co</b>",
      topicId: 100,
      status: "open",
      createdAt: "2026-09-14T11:59:30.000Z",
      messages: [],
      category: "💸 <Withdrawal>",
    },
    now,
  );
  // A fresh ticket is "<1m" old; unescaped, Telegram rejects the whole message.
  assert.equal(
    line,
    '<b>#7</b> · 💸 &lt;Withdrawal&gt; · <a href="tg://user?id=42">&lt;b&gt;Eve &amp; co&lt;/b&gt;</a> · 🕒 &lt;1m',
  );
});

test("formatOpenTicketLine omits a missing category", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");
  const line = formatOpenTicketLine(
    { id: 1, userId: 5, userName: "@bob", topicId: 9, status: "open", createdAt: "2026-09-14T09:00:00.000Z", messages: [] },
    now,
  );
  assert.equal(line, '<b>#1</b> · <a href="tg://user?id=5">@bob</a> · 🕒 3h');
});
