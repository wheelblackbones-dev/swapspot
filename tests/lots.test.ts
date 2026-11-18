import assert from "node:assert/strict";
import test from "node:test";
import { isOpen } from "../lib/display";
import { lotFromRow, lotsFromRows, type LotRow } from "../lib/lots";

const row: LotRow = {
  id: 1, code: "sp", name: "Siam Paragon Garage", address: "991 Rama I Rd, Pathum Wan", operator_name: "Siam Piwat",
  latitude: 13.7464, longitude: 100.534, total_spots: 2600, available_spots: 520, occupancy_pct: 80,
  hourly_rate: 60, daily_max: 300, open_time: "10:00:00", close_time: "22:00:00", ev_chargers: 12, accessible_spots: 28,
  is_covered: true, has_security: true, free_with_purchase: false, rating: 4.6,
  availability_updated_at: "2026-11-18T03:00:00Z", bookable_bays_free: 7,
};

test("a lot_overview row becomes the lot shape the screens use", () => {
  const lot = lotFromRow(row);
  assert.ok(lot);
  assert.deepEqual(
    [lot.id, lot.dbId, lot.name, lot.total, lot.avail, lot.price, lot.daily, lot.hours, lot.op, lot.ev, lot.disabled, lot.covered, lot.bookableFree],
    ["sp", 1, "Siam Paragon Garage", 2600, 520, 60, 300, "10:00–22:00", "Siam Piwat", 12, 28, true, 7],
  );
  assert.equal(isOpen(lot, new Date(2026, 10, 18, 12, 0)), true);
  assert.equal(isOpen(lot, new Date(2026, 10, 18, 23, 0)), false);
});

test("all-day lots, lots without a daily maximum and numeric strings are handled", () => {
  const allDay = lotFromRow({ ...row, open_time: "00:00:00", close_time: "24:00:00", daily_max: null, hourly_rate: "30.00" as unknown as number });
  assert.equal(allDay?.hours, "24 hours");
  assert.equal(allDay?.daily, 0);
  assert.equal(allDay?.price, 30);
  assert.equal(lotFromRow({ ...row, close_time: "24:00:00", open_time: "06:00:00" })?.hours, "06:00–24:00");
});

test("availability is kept inside 0..total and incomplete rows are dropped", () => {
  assert.equal(lotFromRow({ ...row, available_spots: 9999 })?.avail, 2600);
  assert.equal(lotFromRow({ ...row, available_spots: -4 })?.avail, 0);
  assert.equal(lotFromRow({ ...row, code: null }), null);
  assert.equal(lotsFromRows([row, { ...row, id: null }, { ...row, id: 2, code: "cw" }]).length, 2);
});
