import type { Ticket } from "./tickets.js";

/** Telegram limits forum topic names to 128 characters. */
const MAX_TOPIC_TITLE = 128;

export function ticketTopicTitle(nextId: number, userName: string, category?: string): string {
  const title = [`#${nextId}`, category, userName].filter(Boolean).join(" · ");
  // Count by code points so emoji are never split in half.
  const chars = [...title];
  return chars.length <= MAX_TOPIC_TITLE ? title : `${chars.slice(0, MAX_TOPIC_TITLE - 1).join("")}…`;
}

/** Compact, language-neutral age such as "45m", "3h", "2d". */
export function shortAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) {
    return "<1m";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function formatTranscript(ticket: Ticket): string {
  const lines: string[] = [
    `Ticket #${ticket.id}`,
    `User: ${ticket.userName} (id ${ticket.userId})`,
    `Opened: ${ticket.createdAt}`,
  ];

  if (ticket.category) {
    lines.push(`Category: ${ticket.category}`);
  }
  if (ticket.rating !== undefined) {
    lines.push(`Rating: ${ticket.rating}/5`);
  }

  if (ticket.closedAt) {
    lines.push(`Closed: ${ticket.closedAt}`);
    if (ticket.closeReason) {
      lines.push(`Reason: ${ticket.closeReason}`);
    }
  }

  lines.push("", "---");

  if (ticket.messages.length === 0) {
    lines.push("No messages were exchanged.");
  }

  for (const message of ticket.messages) {
    const arrow = message.direction === "in" ? "user -> staff" : "staff -> user";
    lines.push(`[${message.at}] ${arrow} | ${message.from}: ${message.text ?? "(media message)"}`);
  }

  return `${lines.join("\n")}\n`;
}
