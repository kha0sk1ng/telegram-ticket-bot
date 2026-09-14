const staffStatuses = new Set(["creator", "administrator"]);

/** Telegram chat member statuses that count as support staff. */
export function isStaff(memberStatus: string): boolean {
  return staffStatuses.has(memberStatus);
}
