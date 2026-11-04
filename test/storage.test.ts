import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileBackend, MemoryBackend, UpstashBackend } from "../src/storage.js";
import { TicketStore } from "../src/tickets.js";

test("store persists and loads through a backend", async () => {
  const backend = new MemoryBackend();
  const store = await TicketStore.load(backend);
  const ticket = store.open(1, "@alice", 100);
  store.logMessage(ticket.id, "in", "@alice", "hello");
  await store.persist();

  const restored = await TicketStore.load(backend);
  assert.equal(restored.findByUser(1)?.id, ticket.id);
  assert.equal(restored.findByUser(1)?.messages[0].text, "hello");
  assert.equal(restored.peekNextId(), 2);
});

test("reload picks up changes written by another instance", async () => {
  const backend = new MemoryBackend();
  const instanceA = await TicketStore.load(backend);
  const instanceB = await TicketStore.load(backend);

  instanceA.open(1, "@alice", 100);
  await instanceA.persist();

  assert.equal(instanceB.findByUser(1), undefined);
  await instanceB.reload();
  assert.equal(instanceB.findByUser(1)?.topicId, 100);
});

test("empty backend starts a fresh store", async () => {
  const store = await TicketStore.load(new MemoryBackend());
  assert.equal(store.peekNextId(), 1);
  assert.equal(store.openTickets.length, 0);
});

test("corrupt data throws instead of wiping tickets", async () => {
  const backend = new MemoryBackend("{not json");
  await assert.rejects(TicketStore.load(backend), /corrupt/);
  assert.equal(backend.data, "{not json");
});

test("FileBackend round-trips and creates missing directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ticket-bot-"));
  try {
    const backend = new FileBackend(join(dir, "nested", "store.json"));
    assert.equal(await backend.read(), null);
    await backend.write("data");
    assert.equal(await backend.read(), "data");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function fakeFetch(responder: (args: string[]) => { status?: number; body: unknown }) {
  const calls: { url: string; auth: string | null; args: string[] }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body)) as string[];
    calls.push({ url: String(url), auth: new Headers(init?.headers).get("Authorization"), args });
    const { status = 200, body } = responder(args);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { impl, calls };
}

test("UpstashBackend sends GET and SET commands with the bearer token", async () => {
  let stored: string | null = null;
  const { impl, calls } = fakeFetch((args) => {
    if (args[0] === "SET") {
      stored = args[2];
      return { body: { result: "OK" } };
    }
    return { body: { result: stored } };
  });
  const backend = new UpstashBackend("https://example.upstash.io", "secret", "bot:store", impl);

  assert.equal(await backend.read(), null);
  await backend.write("payload");
  assert.equal(await backend.read(), "payload");

  assert.deepEqual(calls[1].args, ["SET", "bot:store", "payload"]);
  assert.equal(calls[1].url, "https://example.upstash.io");
  assert.equal(calls[1].auth, "Bearer secret");
});

test("UpstashBackend surfaces API errors", async () => {
  const { impl } = fakeFetch(() => ({ status: 401, body: { error: "WRONGPASS invalid token" } }));
  const backend = new UpstashBackend("https://example.upstash.io", "bad", "bot:store", impl);
  await assert.rejects(backend.read(), /WRONGPASS/);
});
