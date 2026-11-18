import assert from "node:assert/strict";
import test from "node:test";
import { createDemoLots } from "../lib/demo-lots";
import { findLotByName, parseIntent, searchKind } from "../lib/intent";

const lots = createDemoLots();

test("recognizes aliases without mistaking spot for a lot code", () => {
  assert.equal(findLotByName("is central world full", lots)?.id, "cw");
  assert.equal(findLotByName("find a spot", lots), null);
});

test("extracts distance, features, and a pending yes or no", () => {
  const intent = parseIntent("cheapest EV parking within 500 meters", lots);
  assert.equal(intent.cheapest, true);
  assert.equal(intent.ev, true);
  assert.equal(intent.maxDistance, 0.5);
  assert.equal(parseIntent("yes", lots).yes, true);
  assert.equal(parseIntent("no", lots).no, true);
});

test("recognizes requests for insights, the account and checkout", () => {
  assert.equal(parseIntent("show my insights dashboard", lots).insights, true);
  assert.equal(parseIntent("open my account", lots).account, true);
  assert.equal(parseIntent("sign in", lots).account, true);
  assert.equal(parseIntent("pay now", lots).pay, true);
  assert.equal(parseIntent("how much do I pay at mbk", lots).pay, false);
  const plain = parseIntent("find parking near me", lots);
  assert.deepEqual([plain.insights, plain.account, plain.pay], [false, false, false]);
});

test("classifies a search for the demand log without keeping the words", () => {
  assert.equal(searchKind(parseIntent("cheapest EV parking within 500 meters", lots)), "ev");
  assert.equal(searchKind(parseIntent("cheapest parking", lots)), "cheapest");
  assert.equal(searchKind(parseIntent("any free parking?", lots)), "free");
  assert.equal(searchKind(parseIntent("find parking near me", lots)), "find_nearest");
  assert.equal(searchKind(parseIntent("wheelchair accessible covered parking", lots)), "accessible");
  assert.equal(searchKind(parseIntent("thanks", lots)), "other");
});
