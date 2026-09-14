import assert from "node:assert/strict";
import test from "node:test";
import { formatTranscript, ticketTopicTitle } from "../src/transcript.js";
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
