import assert from "node:assert/strict";
import test from "node:test";
import { isTopicGoneError } from "../src/topics.js";

test("errors meaning the topic no longer exists are recognized", () => {
  for (const description of [
    "Bad Request: TOPIC_ID_INVALID",
    "Bad Request: TOPIC_DELETED",
    "Bad Request: message thread not found",
  ]) {
    assert.equal(isTopicGoneError(description), true, description);
  }
});

test("other errors do not mean the topic is gone", () => {
  for (const description of [
    "Bad Request: TOPIC_NOT_MODIFIED",
    "Bad Request: not enough rights to manage topics",
    "Forbidden: bot is not a member of the supergroup chat",
    "Too Many Requests: retry after 5",
    "",
  ]) {
    assert.equal(isTopicGoneError(description), false, description);
  }
});
