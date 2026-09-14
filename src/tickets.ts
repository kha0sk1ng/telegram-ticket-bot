import { promises as fs } from "node:fs";
import { dirname } from "node:path";

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

/**
 * In-memory ticket store with optional JSON file persistence.
 * When filePath is omitted the store behaves as a pure in-memory object,
 * which keeps unit tests free of filesystem access.
 */
export class TicketStore {
  private state: StoreState;

  constructor(private readonly filePath?: string, state?: StoreState) {
    this.state = state ?? { nextId: 1, tickets: [] };
  }

  static async load(filePath: string): Promise<TicketStore> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const state = JSON.parse(raw) as StoreState;
      return new TicketStore(filePath, state);
    } catch {
      return new TicketStore(filePath);
    }
  }

  async persist(): Promise<void> {
    if (!this.filePath) {
      return;
    }
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
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
