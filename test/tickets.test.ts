import assert from "node:assert/strict";
import test from "node:test";
import { MemoryBackend } from "../src/storage.js";
import { TicketStore } from "../src/tickets.js";

test("open assigns sequential ids and one ticket per user", () => {
  const store = new TicketStore();
  const first = store.open(1, "@alice", 100);
  const second = store.open(2, "@bob", 101);

  assert.equal(first.id, 1);
  assert.equal(second.id, 2);
  assert.equal(store.peekNextId(), 3);
  assert.equal(store.openTickets.length, 2);
});

test("open rejects a second active ticket from the same user", () => {
  const store = new TicketStore();
  store.open(1, "@alice", 100);
  assert.throws(() => store.open(1, "@alice", 101), /already has an open ticket/);
});

test("findByUser and findByTopic only match open tickets", () => {
  const store = new TicketStore();
  const ticket = store.open(1, "@alice", 100);
  store.close(ticket.id);

  assert.equal(store.findByUser(1), undefined);
  assert.equal(store.findByTopic(100), undefined);
  assert.equal(store.openTickets.length, 0);
});

test("close marks the ticket and stores the reason", () => {
  const store = new TicketStore();
  const ticket = store.open(1, "@alice", 100);
  const closed = store.close(ticket.id, "resolved");

  assert.equal(closed?.status, "closed");
  assert.equal(closed?.closeReason, "resolved");
  assert.ok(closed?.closedAt);
});

test("closing twice is a no-op", () => {
  const store = new TicketStore();
  const ticket = store.open(1, "@alice", 100);
  store.close(ticket.id);
  assert.equal(store.close(ticket.id), undefined);
});

test("open stores category and language metadata", () => {
  const store = new TicketStore();
  const ticket = store.open(1, "@alice", 100, { category: "💸 Withdrawal", lang: "ru" });
  assert.equal(ticket.category, "💸 Withdrawal");
  assert.equal(ticket.lang, "ru");
  assert.equal(store.findById(ticket.id), ticket);
});

test("pending messages queue per user, are taken once, and are capped", () => {
  const store = new TicketStore();
  assert.equal(store.addPending(1, 10, "first"), 1);
  assert.equal(store.addPending(1, 11), 2);
  store.addPending(2, 20, "other user");

  assert.deepEqual(store.takePending(1), [
    { messageId: 10, text: "first" },
    { messageId: 11, text: undefined },
  ]);
  assert.deepEqual(store.takePending(1), []);
  assert.equal(store.takePending(2).length, 1);

  for (let i = 0; i < 15; i += 1) {
    store.addPending(3, i);
  }
  assert.equal(store.takePending(3).length, 10);
});

test("rate accepts one 1-5 rating from the owner of a closed ticket", () => {
  const store = new TicketStore();
  const ticket = store.open(1, "@alice", 100);

  assert.equal(store.rate(ticket.id, 1, 5), undefined, "open tickets cannot be rated");
  store.close(ticket.id);
  assert.equal(store.rate(ticket.id, 2, 5), undefined, "only the owner can rate");
  assert.equal(store.rate(ticket.id, 1, 0), undefined, "out of range");
  assert.equal(store.rate(ticket.id, 1, 2.5), undefined, "not an integer");
  assert.equal(store.rate(ticket.id, 1, 4)?.rating, 4);
  assert.equal(store.rate(ticket.id, 1, 1), undefined, "only once");
  assert.equal(store.findById(ticket.id)?.rating, 4);
});

test("state saved before pending messages existed still loads and works", async () => {
  const legacy = JSON.stringify({ nextId: 2, tickets: [] });
  const store = await TicketStore.load(new MemoryBackend(legacy));
  assert.equal(store.addPending(1, 10), 1);
  assert.equal(store.takePending(1).length, 1);
});

test("logMessage appends to open tickets only and stores text", () => {
  const store = new TicketStore();
  const ticket = store.open(1, "@alice", 100);
  store.logMessage(ticket.id, "in", "@alice", "hello");
  store.logMessage(ticket.id, "out", "@staff", "hi, how can we help?");
  assert.equal(ticket.messages.length, 2);
  assert.equal(ticket.messages[0].direction, "in");
  assert.equal(ticket.messages[1].text, "hi, how can we help?");

  store.close(ticket.id);
  store.logMessage(ticket.id, "in", "@alice", "ignored");
  assert.equal(ticket.messages.length, 2);
});
