import assert from "node:assert/strict";
import test from "node:test";
import { baht, countdown, hourLabel, timeAgo } from "../lib/format";

test("baht shows whole amounts without decimals and others with two", () => {
  assert.equal(baht(60), "฿60");
  assert.equal(baht(1250), "฿1,250");
  assert.equal(baht(12.5), "฿12.50");
  assert.equal(baht(Number.NaN), "฿0");
});

test("countdown switches to hours above one hour and never goes negative", () => {
  assert.equal(countdown(599000), "09:59");
  assert.equal(countdown(3 * 3600000 - 1000), "2:59:59");
  assert.equal(countdown(-5000), "00:00");
});

test("hour labels and relative times", () => {
  assert.equal(hourLabel(8), "08:00");
  const now = Date.parse("2026-11-18T10:00:00Z");
  assert.equal(timeAgo(null, now), "never");
  assert.equal(timeAgo("2026-11-18T09:59:45Z", now), "just now");
  assert.equal(timeAgo("2026-11-18T09:55:00Z", now), "5 min ago");
  assert.equal(timeAgo("2026-11-18T07:00:00Z", now), "3 h ago");
  assert.equal(timeAgo("2026-11-16T10:00:00Z", now), "2 d ago");
});
