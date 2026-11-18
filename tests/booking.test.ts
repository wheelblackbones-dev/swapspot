import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingFromRow, describeSession, liveRemaining, liveState, openPaymentOf, paymentFromRow, quote, shownSpotState, shownStatus, spotFromRow,
  type Booking, type SessionInput,
} from "../lib/booking";
import { createDemoLots } from "../lib/demo-lots";

const lots = createDemoLots();
const paragon = { ...lots.find((lot) => lot.id === "sp")!, dbId: 1 };   // ฿60/hr, ฿300 daily maximum
const bigC = { ...lots.find((lot) => lot.id === "bj")!, dbId: 12 };     // free with a purchase
const t0 = Date.parse("2026-11-18T03:00:00Z");
const at = (minutes: number) => new Date(t0 + minutes * 60000).toISOString();

// What the database returns for a spot that was just put on hold (numeric columns can arrive as text).
const heldRow = {
  id: 7, user_id: "u1", status: "pending_payment", duration_hours: 3, hourly_rate: "60.00", amount: "180.00",
  created_at: at(0), hold_expires_at: at(10), starts_at: null, ends_at: null, ended_at: null,
  spot_id: 42, spot_label: "P3", spot_type: "ev", lot_id: 1, lot_code: "sp", lot_name: "Siam Paragon Garage",
  payment_id: 9, payment_method: "promptpay_qr", payment_status: "pending", payment_reference: "SWP-0A1B2C3D4E", paid_at: null,
};
const held = bookingFromRow(heldRow)!;
const paid: Booking = { ...held, status: "active", startsAt: at(1), endsAt: at(181), paymentStatus: "succeeded", paidAt: at(1) };

const base: SessionInput = { mode: "live", lot: paragon, signedIn: true, booking: null, session: null, pick: null, hours: 3, now: t0 };

test("booking and payment rows are read strictly", () => {
  assert.deepEqual([held.id, held.status, held.amount, held.hourlyRate, held.spotLabel, held.lotCode, held.paymentMethod], [7, "pending_payment", 180, 60, "P3", "sp", "promptpay_qr"]);
  assert.equal(bookingFromRow({ ...heldRow, status: "paid" }), null);
  assert.equal(bookingFromRow({ ...heldRow, spot_label: null }), null);
  assert.equal(bookingFromRow(undefined), null);
  assert.deepEqual(paymentFromRow({ id: 9, booking_id: 7, method: "card", status: "pending", reference: "SWP-1", amount: 180, currency: "THB" }), { id: 9, bookingId: 7, method: "card", status: "pending", reference: "SWP-1", amount: 180 });
  assert.equal(paymentFromRow({ id: 9, booking_id: 7, method: "cash", status: "pending", reference: "SWP-1", amount: 180 }), null);
  assert.deepEqual(openPaymentOf(held), { id: 9, bookingId: 7, method: "promptpay_qr", status: "pending", reference: "SWP-0A1B2C3D4E", amount: 180 });
  assert.equal(openPaymentOf(paid), null);
});

test("a hold or a session is only live until its time runs out", () => {
  assert.equal(liveState(held, t0 + 9 * 60000), "pending");
  assert.equal(liveState(held, t0 + 10 * 60000), null);
  assert.equal(liveRemaining(held, t0 + 4 * 60000), 6 * 60000);
  assert.equal(liveState(paid, t0 + 60 * 60000), "active");
  assert.equal(liveState(paid, t0 + 181 * 60000), null);
  assert.equal(liveState({ ...paid, status: "completed" }, t0), null);
  assert.equal(liveState(null, t0), null);
  assert.equal(shownStatus(held, t0 + 11 * 60000), "expired");
  assert.equal(shownStatus(paid, t0 + 200 * 60000), "completed");
  assert.equal(shownStatus({ ...held, status: "cancelled" }, t0), "cancelled");
});

test("the price preview follows the database rule: rate × hours, capped at the daily maximum", () => {
  assert.deepEqual(quote(paragon, 3), { amount: 180, capped: false });
  assert.deepEqual(quote(paragon, 5), { amount: 300, capped: false });
  assert.deepEqual(quote(paragon, 8), { amount: 300, capped: true });
  assert.deepEqual(quote(bigC, 8), { amount: 0, capped: false });
});

test("a driver sees their own spot as theirs", () => {
  const mine = spotFromRow({ id: 42, label: "P3", spot_type: "ev", status: "reserved" });
  const other = spotFromRow({ id: 43, label: "P4", spot_type: "standard", status: "reserved" });
  assert.deepEqual(mine, { id: "P3", dbId: 42, type: "ev", state: "booked" });
  assert.equal(spotFromRow({ id: 44, label: "P5", spot_type: "accessible", status: "available" }).state, "free");
  assert.equal(spotFromRow({ id: 45, label: "P6", spot_type: "standard", status: "occupied" }).state, "occ");
  assert.equal(shownSpotState(mine, "sp", held, null, t0), "mine");
  assert.equal(shownSpotState(other, "sp", held, null, t0), "booked");
  assert.equal(shownSpotState(mine, "sp", held, null, t0 + 11 * 60000), "booked");   // the hold ran out
  const session = { lotId: "sp", spotId: "P2", startedAt: t0, durationMs: 7200000 };
  assert.equal(shownSpotState({ id: "P2", state: "free" }, "sp", null, session, t0), "mine");
  assert.equal(shownSpotState({ id: "P2", state: "free" }, "mbk", null, session, t0), "free");
});

test("session card: a visitor is asked to sign in, a driver must select a spot first", () => {
  const visitor = describeSession({ ...base, signedIn: false, pick: "P2" });
  assert.deepEqual([visitor.action, visitor.button, visitor.price], ["signin", "Sign in to book", "P2 · 3 h × ฿60 = ฿180"]);
  const empty = describeSession(base);
  assert.deepEqual([empty.action, empty.button, empty.buttonDisabled, empty.price, empty.showDurations], ["none", "Book & pay", true, "Select an available spot", true]);
  const picked = describeSession({ ...base, pick: "P2", hours: 8 });
  assert.deepEqual([picked.action, picked.button, picked.buttonDisabled, picked.price], ["book", "Book & pay", false, "P2 · 8 h × ฿60 = ฿300"]);
  assert.match(picked.priceNote, /Daily maximum applied/);
  const free = describeSession({ ...base, lot: bigC, pick: "P1" });
  assert.deepEqual([free.action, free.button, free.price], ["book", "Book P1", "P1 · 3 h × free = Free"]);
  assert.deepEqual([empty.dial.time, empty.dial.label], ["22:00", "Until close"]);
});

test("session card: a held spot can be paid or cancelled, a paid one can be ended", () => {
  const pending = describeSession({ ...base, booking: held, now: t0 + 60000 });
  assert.deepEqual([pending.title, pending.action, pending.button, pending.showCancel, pending.showDurations], ["Payment pending", "pay", "Pay ฿180", true, false]);
  assert.deepEqual([pending.dial.time, pending.dial.label, pending.dial.tone], ["09:00", "Hold · P3", "warn"]);
  const active = describeSession({ ...base, booking: paid, now: t0 + 91 * 60000 });
  assert.deepEqual([active.title, active.action, active.button, active.buttonEnds], ["Parking · P3", "end", "End", true]);
  assert.deepEqual([active.dial.time, active.dial.tone], ["1:30:00", "ok"]);
  assert.match(active.price, /^Paid ฿180 · until \d\d:\d\d$/);
  assert.equal(describeSession({ ...base, booking: paid, now: t0 + 171 * 60000 }).dial.tone, "bad");
  const expired = describeSession({ ...base, booking: held, now: t0 + 11 * 60000 });
  assert.equal(expired.action, "none");   // the hold ran out: back to choosing a spot
});

test("session card: one booking at a time", () => {
  const elsewhere = describeSession({ ...base, lot: { ...bigC }, booking: paid, now: t0 + 60000 });
  assert.equal(elsewhere.button, null);
  assert.deepEqual(elsewhere.elsewhere, { lotId: "sp", text: "You have a parking session at Siam Paragon Garage (P3)." });
  assert.equal(elsewhere.price, "One booking at a time");
});

test("session card: without the database the built-in simulation runs and says so", () => {
  const demo: SessionInput = { ...base, mode: "demo", signedIn: false };
  const idle = describeSession(demo);
  assert.deepEqual([idle.button, idle.buttonDisabled, idle.action], ["Park (demo)", true, "none"]);
  assert.match(idle.priceNote, /simulation: nothing is saved/);
  assert.equal(describeSession({ ...demo, pick: "P2" }).action, "demo-park");
  const session = { lotId: "sp", spotId: "P2", startedAt: t0, durationMs: 2 * 3600000 };
  const running = describeSession({ ...demo, session, now: t0 + 30 * 60000 });
  assert.deepEqual([running.title, running.action, running.button, running.dial.time, running.alert], ["Demo parking session", "demo-end", "End", "1:30:00", "Demo timer only"]);
  const other = describeSession({ ...demo, lot: bigC, session, sessionLotName: "Siam Paragon Garage" });
  assert.deepEqual(other.elsewhere, { lotId: "sp", text: "You have a demo session at Siam Paragon Garage (P2)." });
});
