/** Inline button actions, encoded compactly into Telegram callback data (max 64 bytes). */
export type CallbackAction =
  | { kind: "category"; categoryId: string }
  | { kind: "userClose"; ticketId: number }
  | { kind: "staffClose"; ticketId: number }
  | { kind: "rate"; ticketId: number; rating: number };

export function callbackData(action: CallbackAction): string {
  switch (action.kind) {
    case "category":
      return `cat:${action.categoryId}`;
    case "userClose":
      return `uc:${action.ticketId}`;
    case "staffClose":
      return `sc:${action.ticketId}`;
    case "rate":
      return `rate:${action.ticketId}:${action.rating}`;
  }
}

const positiveInt = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : undefined);

export function parseCallback(data: string): CallbackAction | undefined {
  const [prefix, first, second] = data.split(":");
  switch (prefix) {
    case "cat":
      return first && /^[a-z0-9]+$/.test(first) ? { kind: "category", categoryId: first } : undefined;
    case "uc":
    case "sc": {
      const ticketId = positiveInt(first);
      if (ticketId === undefined) {
        return undefined;
      }
      return prefix === "uc" ? { kind: "userClose", ticketId } : { kind: "staffClose", ticketId };
    }
    case "rate": {
      const ticketId = positiveInt(first);
      const rating = positiveInt(second);
      return ticketId !== undefined && rating !== undefined ? { kind: "rate", ticketId, rating } : undefined;
    }
    default:
      return undefined;
  }
}
