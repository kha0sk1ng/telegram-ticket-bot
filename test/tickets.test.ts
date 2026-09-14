import assert from "node:assert/strict";
import test from "node:test";
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
