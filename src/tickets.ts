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
  messages: TranscriptEntry[];
}

interface StoreState {
  nextId: number;
  tickets: Ticket[];
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

  open(userId: number, userName: string, topicId: number): Ticket {
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
}
