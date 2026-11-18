import assert from "node:assert/strict";
import test from "node:test";
import { createDemoLots } from "../lib/demo-lots";
import {
  actionFromRow, bangkokHour, bestLotNow, cityKnowledge, hourlyFromRow, mineFromJson, patternFromRow, peakOf, platformFromJson, summaryFromRow,
  type PublicInsights,
} from "../lib/insights";

const hourly = [
  { hour_of_day: 7, readings: 14, avg_occupancy_pct: "41.5" },
  { hour_of_day: 9, readings: 14, avg_occupancy_pct: 52 },
  { hour_of_day: 13, readings: 14, avg_occupancy_pct: 78.4, avg_available_spots: 310 },
  { hour_of_day: 18, readings: 14, avg_occupancy_pct: 91.2 },
  { hour_of_day: 23, readings: 14, avg_occupancy_pct: 30 },
].map(hourlyFromRow).filter((point) => point !== null);

const patternRow = {
  lot_id: 5, lot_code: "ic", lot_name: "ICONSIAM Parking", hourly_rate: 70, readings: 337, avg_occupancy_pct: 71,
  peak_hour: 18, peak_occupancy_pct: 93.1, quiet_hour: 8, quiet_occupancy_pct: 44, weekday_occupancy_pct: 68, weekend_occupancy_pct: 80, demand_level: "high",
};

test("view rows are read into typed insight records", () => {
  assert.deepEqual(summaryFromRow({ operators: 14, lots: 16, bays: 192, sensor_readings: 5392, first_reading_at: null, last_reading_at: "2026-11-18T03:00:00Z" }),
    { operators: 14, lots: 16, bays: 192, sensorReadings: 5392, lastReadingAt: "2026-11-18T03:00:00Z" });
  assert.equal(hourly.length, 5);
  assert.deepEqual(hourly[0], { hour: 7, occupancyPct: 41.5, readings: 14, availableSpots: null });
  assert.equal(hourlyFromRow({ hour_of_day: 24, avg_occupancy_pct: 10 }), null);
  const pattern = patternFromRow(patternRow);
  assert.deepEqual([pattern?.lotCode, pattern?.demandLevel, pattern?.peakHour, pattern?.peakPct], ["ic", "high", 18, 93.1]);
  assert.equal(patternFromRow({ ...patternRow, demand_level: "extreme" }), null);
  const action = actionFromRow({ lot_code: "ic", lot_name: "ICONSIAM Parking", operator_action: "raise_peak_price", operator_tip: "Test a peak-hour rate.", driver_tip: "Book before you set off." });
  assert.equal(action?.operatorAction, "raise_peak_price");
  assert.equal(actionFromRow({ lot_code: "ic", lot_name: "ICONSIAM Parking", operator_action: "close_the_lot" }), null);
});

test("city-wide knowledge: busiest and quietest daytime hours, and demand levels", () => {
  const insights: PublicInsights = {
    summary: null,
    cityHourly: hourly,
    patterns: [patternFromRow(patternRow)!, patternFromRow({ ...patternRow, lot_code: "sk", demand_level: "low", weekday_occupancy_pct: 40, weekend_occupancy_pct: 50 })!],
    actions: [],
  };
  const city = cityKnowledge(insights);
  assert.equal(peakOf(hourly)?.hour, 18);
  assert.equal(city.busiest?.hour, 18);
  assert.equal(city.calmest?.hour, 9);   // 07:00 and 23:00 are outside the daytime window
  assert.deepEqual(city.levels, { high: 1, balanced: 0, low: 1 });
  assert.equal(city.weekdayPct, 54);
  assert.equal(city.weekendPct, 65);
  assert.equal(peakOf([]), null);
});

test("insight functions: JSON is read defensively", () => {
  const platform = platformFromJson({
    data: { users: 3, bookings: 5, payments: 6, search_events: 9 },
    information: { bookings_paid: 4, revenue: "560.00", average_ticket: 140, average_hours: 2.5, payment_success_rate: 0.667,
      by_lot: [{ lot_name: "Siam Paragon Garage", bookings: 2, revenue: 360 }, { bookings: 1 }], by_intent: [{ intent: "cheapest", searches: 5 }] },
    knowledge: { conversion_rate: 0.8, busiest_booking_hour: 18, top_lot: "Siam Paragon Garage", preferred_method: "promptpay_qr" },
    wisdom: [{ title: "Checkout is working", detail: "80% of holds turn into paid bookings." }, { detail: "no title" }],
  });
  assert.deepEqual([platform?.information.revenue, platform?.information.byLot.length, platform?.wisdom.length], [560, 1, 1]);
  assert.equal(platformFromJson({ data: {} }), null);
  const mine = mineFromJson({
    data: { bookings: 2, payments: 3, search_events: 4 },
    information: { bookings_paid: 1, total_spent: 180, hours_booked: 3, favourite_lot: "Siam Paragon Garage", favourite_lot_visits: 1 },
    knowledge: { usual_hour: 10, usual_day_type: "weekday", top_intent: "find_nearest" },
    wisdom: [],
  });
  assert.deepEqual([mine?.information.totalSpent, mine?.knowledge.usualHour, mine?.information.favouriteLot], [180, 10, "Siam Paragon Garage"]);
  assert.equal(mineFromJson("nope"), null);
});

test("right-now advice picks the nearest open lot that is not filling up", () => {
  const location = { lat: 13.746, lng: 100.535 };
  const noon = new Date(2026, 10, 18, 12, 0);
  const lots = createDemoLots();
  assert.equal(bestLotNow(lots, location, 3, noon)?.id, "sp");
  const busy = lots.map((lot) => (lot.id === "sp" ? { ...lot, avail: 30 } : lot));   // almost full: prefer the next one
  assert.equal(bestLotNow(busy, location, 3, noon)?.id, "bt");
  assert.equal(bestLotNow(lots, location, 0.01, noon), null);
  assert.equal(bestLotNow(lots.map((lot) => ({ ...lot, avail: 0 })), location, 3, noon), null);
  assert.equal(bangkokHour(Date.parse("2026-11-18T03:30:00Z")), 10);
});
