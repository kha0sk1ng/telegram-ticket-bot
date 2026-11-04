/**
 * Telegram error descriptions that mean a forum topic no longer exists.
 * Verified against the live Bot API: reopenForumTopic and deleteForumTopic
 * answer TOPIC_ID_INVALID for a deleted topic (and for General).
 */
const TOPIC_GONE = /TOPIC_ID_INVALID|TOPIC_DELETED|thread not found/i;

export function isTopicGoneError(description: string): boolean {
  return TOPIC_GONE.test(description);
}
