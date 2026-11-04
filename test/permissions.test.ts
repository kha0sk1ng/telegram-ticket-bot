import assert from "node:assert/strict";
import test from "node:test";
import { isOwner, isStaff } from "../src/permissions.js";

test("group creator and administrators are staff", () => {
  assert.equal(isStaff("creator"), true);
  assert.equal(isStaff("administrator"), true);
});

test("regular members, restrictions, and bans are not staff", () => {
  assert.equal(isStaff("member"), false);
  assert.equal(isStaff("restricted"), false);
  assert.equal(isStaff("left"), false);
  assert.equal(isStaff("kicked"), false);
});

test("only the group creator counts as owner", () => {
  assert.equal(isOwner("creator"), true);
  assert.equal(isOwner("administrator"), false);
  assert.equal(isOwner("member"), false);
});
