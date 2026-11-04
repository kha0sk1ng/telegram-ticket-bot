const staffStatuses = new Set(["creator", "administrator"]);

/** Telegram chat member statuses that count as support staff. */
export function isStaff(memberStatus: string): boolean {
  return staffStatuses.has(memberStatus);
}

/** Only the group creator may run irreversible actions such as /purge. */
export function isOwner(memberStatus: string): boolean {
  return memberStatus === "creator";
}
