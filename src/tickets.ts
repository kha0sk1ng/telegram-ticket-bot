import type { Lang } from "./i18n.js";
import type { StorageBackend } from "./storage.js";

export type TicketStatus = "open" | "closed";

export interface TranscriptEntry {
  /** "in" = user to staff, "out" = staff to user. */
  direction: "in" | "out";
  from: string;
  at: string;
  text?: string;
}

export interface Ticket {
  id: number;
  userId: number;
  userName: string;
  topicId: number;
  status: TicketStatus;
  createdAt: string;
  closedAt?: string;
  closeReason?: string;
  /** Category label in the staff language, captured when the ticket opened. */
  category?: string;
  lang?: Lang;
  /** 1-5 stars, given by the user after the ticket closed. */
  rating?: number;
  messages: TranscriptEntry[];
}

/** A message a user sent before choosing a category; relayed once the ticket opens. */
export interface PendingMessage {
  messageId: number;
  text?: string;
}

export interface OpenOptions {
  category?: string;
  lang?: Lang;
}

const MAX_PENDING = 10;

interface StoreState {
  nextId: number;
  tickets: Ticket[];
  /** Keyed by user id. Optional so state saved by older versions still loads. */
  pending?: Record<string, PendingMessage[]>;
}

function emptyState(): StoreState {
  return { nextId: 1, tickets: [] };
}

/**
 * In-memory ticket store with pluggable persistence.
 * When no backend is given the store behaves as a pure in-memory object,
 * which keeps unit tests free of I/O.
 */
export class TicketStore {
  private state: StoreState;

  constructor(private readonly backend?: StorageBackend, state?: StoreState) {
    this.state = state ?? emptyState();
  }

  static async load(backend: StorageBackend): Promise<TicketStore> {
    const store = new TicketStore(backend);
    await store.reload();
    return store;
  }

  /**
   * Re-read state from the backend. Serverless instances do not share memory,
   * so the bot reloads before each update to see changes made by other instances.
   * Missing data means a fresh store. Corrupt data throws instead of resetting,
   * because a reset followed by persist() would wipe every ticket.
   */
  async reload(): Promise<void> {
    if (!this.backend) {
      return;
    }
    const raw = await this.backend.read();
    if (!raw) {
      this.state = emptyState();
      return;
    }
    try {
      this.state = JSON.parse(raw) as StoreState;
    } catch {
      throw new Error("Ticket store data is corrupt; refusing to overwrite it.");
    }
  }

  async persist(): Promise<void> {
    if (!this.backend) {
      return;
    }
    await this.backend.write(`${JSON.stringify(this.state, null, 2)}\n`);
  }

  peekNextId(): number {
    return this.state.nextId;
  }

  get openTickets(): Ticket[] {
    return this.state.tickets.filter((ticket) => ticket.status === "open");
  }

  findByUser(userId: number): Ticket | undefined {
    return this.openTickets.find((ticket) => ticket.userId === userId);
  }

  findByTopic(topicId: number): Ticket | undefined {
    return this.openTickets.find((ticket) => ticket.topicId === topicId);
  }

  findById(ticketId: number): Ticket | undefined {
    return this.state.tickets.find((ticket) => ticket.id === ticketId);
  }

  open(userId: number, userName: string, topicId: number, options: OpenOptions = {}): Ticket {
    if (this.findByUser(userId)) {
      throw new Error("This user already has an open ticket.");
    }

    const ticket: Ticket = {
      id: this.state.nextId,
      userId,
      userName,
      topicId,
      status: "open",
      createdAt: new Date().toISOString(),
      ...(options.category ? { category: options.category } : {}),
      ...(options.lang ? { lang: options.lang } : {}),
      messages: [],
    };
    this.state.nextId += 1;
    this.state.tickets.push(ticket);
    return ticket;
  }

  logMessage(ticketId: number, direction: "in" | "out", from: string, text?: string): void {
    const ticket = this.state.tickets.find((entry) => entry.id === ticketId);
    if (!ticket || ticket.status !== "open") {
      return;
    }
    ticket.messages.push({ direction, from, at: new Date().toISOString(), text });
  }

  close(ticketId: number, reason?: string): Ticket | undefined {
    const ticket = this.state.tickets.find((entry) => entry.id === ticketId);
    if (!ticket || ticket.status !== "open") {
      return undefined;
    }

    ticket.status = "closed";
    ticket.closedAt = new Date().toISOString();
    ticket.closeReason = reason;
    return ticket;
  }

  /** Queue a message sent before a category was chosen. Returns the queue length. */
  addPending(userId: number, messageId: number, text?: string): number {
    this.state.pending ??= {};
    const queue = (this.state.pending[userId] ??= []);
    if (queue.length < MAX_PENDING) {
      queue.push({ messageId, text });
    }
    return queue.length;
  }

  /** Remove and return the user's queued messages, oldest first. */
  takePending(userId: number): PendingMessage[] {
    const queue = this.state.pending?.[userId] ?? [];
    if (this.state.pending) {
      delete this.state.pending[userId];
    }
    return queue;
  }

  /** Record a 1-5 rating from the ticket owner, once, after the ticket closed. */
  rate(ticketId: number, userId: number, rating: number): Ticket | undefined {
    const ticket = this.findById(ticketId);
    if (
      !ticket ||
      ticket.status !== "closed" ||
      ticket.userId !== userId ||
      ticket.rating !== undefined ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return undefined;
    }
    ticket.rating = rating;
    return ticket;
  }
}
