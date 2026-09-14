import type { Ticket } from "./tickets.js";

export function ticketTopicTitle(nextId: number, userName: string): string {
  return `#${nextId} · ${userName}`;
}

export function formatTranscript(ticket: Ticket): string {
  const lines: string[] = [
    `Ticket #${ticket.id}`,
    `User: ${ticket.userName} (id ${ticket.userId})`,
    `Opened: ${ticket.createdAt}`,
  ];

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
