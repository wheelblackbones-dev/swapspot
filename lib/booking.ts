// Booking and payment rules shared by the spot, checkout and account screens.
// The database decides prices, holds and payment status (see supabase/migrations);
// this file only reads those results and works out what to show next.

import { asNumber, asRecord, asText, oneOf } from "./coerce";
import type { DemoLot } from "./demo-lots";
import { baht, clockTime, countdown } from "./format";
import { sessionRemaining, type ParkingSession, type Spot, type SpotState, type SpotType } from "./session";

export type BookingStatus = "pending_payment" | "active" | "completed" | "cancelled" | "expired";
export type PaymentMethod = "promptpay_qr" | "card";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled";

/** One row of the public.booking_details view (a booking with its spot, lot and latest payment). */
export type Booking = {
  id: number;
  status: BookingStatus;
  durationHours: number;
  hourlyRate: number;
  amount: number;
  createdAt: string;
  holdExpiresAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
  spotId: number;
  spotLabel: string;
  spotType: string;
  lotId: number;
  lotCode: string;
  lotName: string;
  paymentId: number | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  paymentReference: string | null;
  paidAt: string | null;
};

/** One row of public.payments (a payment attempt). */
export type Payment = {
  id: number;
  bookingId: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string;
  amount: number;
};

export const DURATIONS = [1, 2, 3, 4, 6, 8] as const;
export const HOLD_MS = 10 * 60 * 1000;
export const METHOD_NAMES: Record<PaymentMethod, string> = { promptpay_qr: "PromptPay QR", card: "Card" };
export const STATUS_NAMES: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Hold expired",
};

const BOOKING_STATUSES: BookingStatus[] = ["pending_payment", "active", "completed", "cancelled", "expired"];
const PAYMENT_METHODS: PaymentMethod[] = ["promptpay_qr", "card"];
const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "succeeded", "failed", "cancelled"];

/** Reads a booking_details row, or the JSON a booking function returns. Anything incomplete gives null. */
export function bookingFromRow(value: unknown): Booking | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = asNumber(row.id);
  const status = oneOf(row.status, BOOKING_STATUSES);
  const durationHours = asNumber(row.duration_hours);
  const hourlyRate = asNumber(row.hourly_rate);
  const amount = asNumber(row.amount);
  const createdAt = asText(row.created_at);
  const spotId = asNumber(row.spot_id);
  const spotLabel = asText(row.spot_label);
  const lotId = asNumber(row.lot_id);
  const lotCode = asText(row.lot_code);
  const lotName = asText(row.lot_name);
  if (id === null || !status || durationHours === null || hourlyRate === null || amount === null || !createdAt ||
      spotId === null || !spotLabel || lotId === null || !lotCode || !lotName) {
    return null;
  }
  return {
    id, status, durationHours, hourlyRate, amount, createdAt, spotId, spotLabel, lotId, lotCode, lotName,
    holdExpiresAt: asText(row.hold_expires_at),
    startsAt: asText(row.starts_at),
    endsAt: asText(row.ends_at),
    endedAt: asText(row.ended_at),
    spotType: asText(row.spot_type) ?? "standard",
    paymentId: asNumber(row.payment_id),
    paymentMethod: oneOf(row.payment_method, PAYMENT_METHODS),
    paymentStatus: oneOf(row.payment_status, PAYMENT_STATUSES),
    paymentReference: asText(row.payment_reference),
    paidAt: asText(row.paid_at),
  };
}

/** Reads the JSON that start_payment returns (a public.payments row). */
export function paymentFromRow(value: unknown): Payment | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = asNumber(row.id);
  const bookingId = asNumber(row.booking_id);
  const method = oneOf(row.method, PAYMENT_METHODS);
  const status = oneOf(row.status, PAYMENT_STATUSES);
  const reference = asText(row.reference);
  const amount = asNumber(row.amount);
  if (id === null || bookingId === null || !method || !status || !reference || amount === null) return null;
  return { id, bookingId, method, status, reference, amount };
}

/** The payment attempt that is already open on a booking, if the booking row carries one. */
export function openPaymentOf(booking: Booking): Payment | null {
  if (booking.paymentStatus !== "pending" || booking.paymentId === null || !booking.paymentMethod || !booking.paymentReference) {
    return null;
  }
  return {
    id: booking.paymentId,
    bookingId: booking.id,
    method: booking.paymentMethod,
    status: "pending",
    reference: booking.paymentReference,
    amount: booking.amount,
  };
}

export type LiveState = "pending" | "active" | null;

/** "pending": unpaid hold that has not run out · "active": paid, time left · null: nothing in progress. */
export function liveState(booking: Booking | null, now: number): LiveState {
  if (!booking) return null;
  if (booking.status === "pending_payment") {
    return booking.holdExpiresAt !== null && Date.parse(booking.holdExpiresAt) > now ? "pending" : null;
  }
  if (booking.status === "active") {
    return booking.endsAt !== null && Date.parse(booking.endsAt) > now ? "active" : null;
  }
  return null;
}

/** Milliseconds left on the hold (pending) or on the parking session (active). */
export function liveRemaining(booking: Booking, now: number): number {
  const until = booking.status === "pending_payment" ? booking.holdExpiresAt : booking.endsAt;
  return until === null ? 0 : Math.max(0, Date.parse(until) - now);
}

/** Status to show in the history list: a hold or session whose time has passed is shown as finished. */
export function shownStatus(booking: Booking, now: number): BookingStatus {
  if (booking.status === "pending_payment" && !liveState(booking, now)) return "expired";
  if (booking.status === "active" && !liveState(booking, now)) return "completed";
  return booking.status;
}

/** Price preview. Same rule as the database: hourly rate × hours, capped at the daily maximum. */
export function quote(lot: Pick<DemoLot, "price" | "daily">, hours: number): { amount: number; capped: boolean } {
  const full = lot.price * hours;
  return lot.daily > 0 && full > lot.daily ? { amount: lot.daily, capped: true } : { amount: full, capped: false };
}

/** What a spot looks like to this driver: their own spot is "mine", whatever the stored state says. */
export function shownSpotState(spot: Spot, lotId: string, booking: Booking | null, session: ParkingSession | null, now: number): SpotState {
  if (spot.dbId !== undefined && booking && booking.spotId === spot.dbId && liveState(booking, now)) return "mine";
  if (spot.dbId === undefined && session && session.lotId === lotId && session.spotId === spot.id) return "mine";
  return spot.state === "mine" ? "free" : spot.state;
}

/** parking_spots row -> spot for the grid. */
export function spotFromRow(row: { id: number; label: string; spot_type: string; status: string }): Spot {
  const type = oneOf<SpotType>(row.spot_type, ["standard", "ev", "accessible"]) ?? "standard";
  const state: SpotState = row.status === "available" ? "free" : row.status === "occupied" ? "occ" : "booked";
  return { id: row.label, dbId: row.id, type, state };
}

export type SessionAction = "signin" | "book" | "pay" | "end" | "demo-park" | "demo-end" | "none";

/** Everything the session card under the spot grid shows, worked out from the current state. */
export type SessionCard = {
  title: string;
  action: SessionAction;
  /** Label of the main button, or null when there is nothing to press. */
  button: string | null;
  buttonDisabled: boolean;
  /** The red "End" style. */
  buttonEnds: boolean;
  price: string;
  priceNote: string;
  showDurations: boolean;
  showCancel: boolean;
  /** Set when this driver's booking or demo session is at another lot. */
  elsewhere: { lotId: string; text: string } | null;
  dial: { time: string; label: string; fraction: number; tone: "ok" | "warn" | "bad" };
  alert: string | null;
};

export type SessionInput = {
  /** "live": spots, bookings and payments are in the database. "demo": built-in simulation, nothing is saved. */
  mode: "live" | "demo";
  lot: DemoLot;
  signedIn: boolean;
  /** This driver's booking in the database, at any lot. */
  booking: Booking | null;
  /** The in-memory demo session, at any lot. */
  session: ParkingSession | null;
  /** Name of the lot that demo session is in. */
  sessionLotName?: string;
  /** Label of the free spot selected in this lot. */
  pick: string | null;
  hours: number;
  /** Clock aligned with the database (milliseconds). */
  now: number;
};

function idleDial(lot: DemoLot): SessionCard["dial"] {
  if (lot.hours === "24 hours") return { time: "24 h", label: "Open all day", fraction: 0.75, tone: "ok" };
  return { time: lot.hours.match(/(\d{1,2}:\d{2})$/)?.[1] ?? "—", label: "Until close", fraction: 0.75, tone: "ok" };
}

function tone(fraction: number): "ok" | "warn" | "bad" {
  return fraction < 0.15 ? "bad" : fraction < 0.35 ? "warn" : "ok";
}

export function describeSession(input: SessionInput): SessionCard {
  const { mode, lot, signedIn, booking, session, sessionLotName, pick, hours, now } = input;
  const idle: SessionCard = {
    title: "Closing Time", action: "none", button: null, buttonDisabled: false, buttonEnds: false,
    price: "", priceNote: "", showDurations: false, showCancel: false, elsewhere: null, dial: idleDial(lot), alert: null,
  };
  const price = quote(lot, hours);
  const sum = `${hours} h × ${lot.price === 0 ? "free" : baht(lot.price)} = ${price.amount === 0 ? "Free" : baht(price.amount)}`;

  if (mode === "demo") {
    if (session && session.lotId !== lot.id) {
      return {
        ...idle,
        price: "One demo session at a time",
        priceNote: "End it to try another lot.",
        elsewhere: { lotId: session.lotId, text: `You have a demo session at ${sessionLotName ?? "another lot"} (${session.spotId}).` },
      };
    }
    if (session) {
      const left = sessionRemaining(session, now);
      const fraction = left / session.durationMs;
      return {
        ...idle,
        title: "Demo parking session", action: "demo-end", button: "End", buttonEnds: true,
        price: `Demo session at ${session.spotId}`,
        priceNote: "Simulated timer. Nothing is saved and no real spot is reserved.",
        dial: { time: countdown(left), label: `Parking · ${session.spotId}`, fraction, tone: tone(fraction) },
        alert: "Demo timer only",
      };
    }
    return {
      ...idle,
      action: pick ? "demo-park" : "none", button: "Park (demo)", buttonDisabled: !pick, showDurations: true,
      price: pick ? `${pick} · ${sum}` : "Select an available spot",
      priceNote: "The database is not connected, so this is a simulation: nothing is saved.",
    };
  }

  const state = liveState(booking, now);
  if (booking && state && booking.lotCode !== lot.id) {
    return {
      ...idle,
      price: "One booking at a time",
      priceNote: "Finish or cancel it to book here.",
      elsewhere: {
        lotId: booking.lotCode,
        text: `You have ${state === "pending" ? "a spot on hold" : "a parking session"} at ${booking.lotName} (${booking.spotLabel}).`,
      },
    };
  }
  if (booking && state === "pending") {
    const left = liveRemaining(booking, now);
    return {
      ...idle,
      title: "Payment pending", action: "pay", button: `Pay ${baht(booking.amount)}`, showCancel: true,
      price: `${booking.spotLabel} · ${booking.durationHours} h × ${baht(booking.hourlyRate)} = ${baht(booking.amount)}`,
      priceNote: "The spot is held for you until the timer runs out.",
      dial: { time: countdown(left), label: `Hold · ${booking.spotLabel}`, fraction: Math.min(1, left / HOLD_MS), tone: "warn" },
    };
  }
  if (booking && state === "active") {
    const left = liveRemaining(booking, now);
    const total = booking.startsAt && booking.endsAt ? Date.parse(booking.endsAt) - Date.parse(booking.startsAt) : 0;
    const fraction = total > 0 ? Math.min(1, left / total) : 0;
    return {
      ...idle,
      title: `Parking · ${booking.spotLabel}`, action: "end", button: "End", buttonEnds: true,
      price: `${booking.amount === 0 ? "Free with a purchase" : `Paid ${baht(booking.amount)}`}${booking.endsAt ? ` · until ${clockTime(booking.endsAt)}` : ""}`,
      priceNote: `${booking.paymentReference ? `Ref ${booking.paymentReference} · ` : ""}Ending early does not refund unused time.`,
      dial: { time: countdown(left), label: `Parking · ${booking.spotLabel}`, fraction, tone: tone(fraction) },
      alert: "You are told 15 minutes before the end",
    };
  }
  if (!signedIn) {
    return {
      ...idle,
      action: "signin", button: "Sign in to book", showDurations: true,
      price: `${pick ? `${pick} · ` : ""}${sum}`,
      priceNote: "Sign in to hold a spot and pay.",
    };
  }
  if (!pick) {
    return {
      ...idle,
      button: price.amount === 0 ? "Book" : "Book & pay", buttonDisabled: true, showDurations: true,
      price: "Select an available spot",
      priceNote: `${sum}${price.capped ? " (daily maximum)" : ""}`,
    };
  }
  return {
    ...idle,
    action: "book", button: price.amount === 0 ? `Book ${pick}` : "Book & pay", showDurations: true,
    price: `${pick} · ${sum}`,
    priceNote: `${price.capped ? "Daily maximum applied. " : ""}${price.amount === 0
      ? "Free with a purchase at the store."
      : "The spot is held for 10 minutes while you pay."}`,
  };
}
