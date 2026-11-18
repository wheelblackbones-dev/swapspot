// SwapSpot data layer. The only file that talks to the database (Supabase).
// Every function returns plain data, or throws an Error whose message can be shown as it is.
//
//   Reads   -> tables and views       (protected by row level security)
//   Writes  -> database functions     (create_booking, start_payment, ...)
//              so prices and payment status are decided by the database,
//              never by the browser.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { bookingFromRow, paymentFromRow, spotFromRow, type Booking, type Payment, type PaymentMethod } from "./booking";
import type { Database } from "./database.types";
import type { DemoLot } from "./demo-lots";
import { ALREADY_REGISTERED, profileError, readableError } from "./errors";
import {
  actionFromRow, hourlyFromRow, mineFromJson, patternFromRow, platformFromJson, summaryFromRow,
  type HourlyPoint, type MyInsights, type PlatformInsights, type PublicInsights,
} from "./insights";
import type { SearchKind } from "./intent";
import { lotsFromRows } from "./lots";
import type { Spot } from "./session";
import { supabaseConfig } from "./supabase-config";

export type Account = { id: string; email: string; name: string };
export type Profile = { fullName: string; phone: string; licensePlate: string };
export type SearchSource = "voice" | "text" | "chip";

export const backendReady = Boolean(supabaseConfig.url && supabaseConfig.publishableKey);

let client: SupabaseClient<Database> | null = null;

function db(): SupabaseClient<Database> {
  if (!backendReady) throw new Error("The database connection is not set up.");
  client ??= createClient<Database>(supabaseConfig.url, supabaseConfig.publishableKey);
  return client;
}

function fail(error: unknown): never {
  throw new Error(readableError(error), { cause: error });
}

function present<T>(value: T | null): value is T {
  return value !== null;
}

/* ---------- sign-in (Supabase Auth) ---------- */

function accountFromUser(user: User): Account {
  const name: unknown = user.user_metadata?.full_name;
  return { id: user.id, email: user.email ?? "", name: typeof name === "string" ? name : "" };
}

/**
 * Calls back with the signed-in account (or null) once at start-up, then on every sign-in,
 * sign-out and token refresh. Returns the function that stops listening.
 */
export function onAuthChange(callback: (account: Account | null) => void): () => void {
  const { data } = db().auth.onAuthStateChange((_event, session) => {
    // Supabase must not be called from inside this callback (it can deadlock): hand over on the next tick.
    setTimeout(() => callback(session ? accountFromUser(session.user) : null), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signUp(fullName: string, email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await db().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) fail(error);
  // With "Confirm email" on, an address that is already registered comes back with an empty identities list.
  if (data.user && !data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error(ALREADY_REGISTERED);
  }
  return { needsEmailConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) fail(error);
}

export async function signOut(): Promise<void> {
  const { error } = await db().auth.signOut();
  if (error) fail(error);
}

/* ---------- parking data (public) ---------- */
// The three reads below are repeated on a timer by the screens, so the client's own automatic
// retries are switched off for them: a missed refresh is simply followed by the next one.

export async function fetchLots(): Promise<DemoLot[]> {
  const { data, error } = await db().from("lot_overview").select("*").order("id").retry(false);
  if (error) fail(error);
  return lotsFromRows(data ?? []);
}

export async function fetchSpots(lotDbId: number): Promise<Spot[]> {
  const { data, error } = await db().from("parking_spots").select("id,label,spot_type,status").eq("lot_id", lotDbId).order("id").retry(false);
  if (error) fail(error);
  return (data ?? []).map(spotFromRow);
}

/* ---------- profile (public.profiles, one row per account) ---------- */

type ProfileRow = { full_name: string | null; phone: string | null; license_plate: string | null };

function profileFromRow(row: ProfileRow): Profile {
  return { fullName: row.full_name ?? "", phone: row.phone ?? "", licensePlate: row.license_plate ?? "" };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from("profiles").select("full_name,phone,license_plate").eq("id", userId).limit(1);
  if (error) fail(error);
  return data?.[0] ? profileFromRow(data[0]) : null;
}

export async function saveProfile(userId: string, fields: Profile): Promise<Profile> {
  const clean = (value: string) => value.trim() || null;
  const patch: ProfileRow = { full_name: clean(fields.fullName), phone: clean(fields.phone), license_plate: clean(fields.licensePlate) };
  const { data, error } = await db().from("profiles").update(patch).eq("id", userId).select("full_name,phone,license_plate");
  if (error) throw new Error(profileError(error), { cause: error });
  return profileFromRow(data?.[0] ?? patch);
}

/* ---------- bookings and payments ---------- */

function expectBooking(value: unknown): Booking {
  const booking = bookingFromRow(value);
  if (!booking) throw new Error("The database returned an answer this app does not understand.");
  return booking;
}

/** This driver's booking that is on hold or in progress, if any. */
export async function fetchLiveBooking(): Promise<Booking | null> {
  const { data, error } = await db().from("booking_details").select("*")
    .in("status", ["pending_payment", "active"]).order("created_at", { ascending: false }).limit(1).retry(false);
  if (error) fail(error);
  return bookingFromRow(data?.[0]);
}

export async function fetchBookings(limit = 20): Promise<Booking[]> {
  const { data, error } = await db().from("booking_details").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) fail(error);
  return (data ?? []).map(bookingFromRow).filter(present);
}

export async function createBooking(spotDbId: number, hours: number): Promise<Booking> {
  const { data, error } = await db().rpc("create_booking", { p_spot_id: spotDbId, p_hours: hours });
  if (error) fail(error);
  return expectBooking(data);
}

export async function startPayment(bookingId: number, method: PaymentMethod): Promise<Payment> {
  const { data, error } = await db().rpc("start_payment", { p_booking_id: bookingId, p_method: method });
  if (error) fail(error);
  const payment = paymentFromRow(data);
  if (!payment) throw new Error("The database returned an answer this app does not understand.");
  return payment;
}

/** Simulated payment result. No money moves: the database only records the attempt and its outcome. */
export async function confirmDemoPayment(paymentId: number, outcome: "succeeded" | "failed"): Promise<Booking> {
  const { data, error } = await db().rpc("confirm_demo_payment", { p_payment_id: paymentId, p_outcome: outcome });
  if (error) fail(error);
  return expectBooking(data);
}

export async function cancelBooking(bookingId: number): Promise<Booking> {
  const { data, error } = await db().rpc("cancel_booking", { p_booking_id: bookingId });
  if (error) fail(error);
  return expectBooking(data);
}

export async function endBooking(bookingId: number): Promise<Booking> {
  const { data, error } = await db().rpc("end_booking", { p_booking_id: bookingId });
  if (error) fail(error);
  return expectBooking(data);
}

/* ---------- demand signals ---------- */

/** Records the kind of request a signed-in driver made, never what was said. Never interrupts the driver. */
export function logSearch(source: SearchSource, intent: SearchKind, lotDbId?: number): void {
  if (!backendReady) return;
  db().from("search_events").insert({ source, intent, lot_id: lotDbId ?? null }).then(({ error }) => {
    if (error) console.warn("search log skipped:", error.message);
  });
}

/* ---------- DIKW insights ---------- */

export async function fetchPublicInsights(): Promise<PublicInsights> {
  const [summary, cityHourly, patterns, actions] = await Promise.all([
    db().from("dikw_data_summary").select("*"),
    db().from("dikw_information_city_hourly").select("*").order("hour_of_day"),
    db().from("dikw_knowledge_lot_patterns").select("*").order("peak_occupancy_pct", { ascending: false }),
    db().from("dikw_wisdom_lot_actions").select("*"),
  ]);
  for (const result of [summary, cityHourly, patterns, actions]) {
    if (result.error) fail(result.error);
  }
  return {
    summary: summaryFromRow(summary.data?.[0]),
    cityHourly: (cityHourly.data ?? []).map(hourlyFromRow).filter(present),
    patterns: (patterns.data ?? []).map(patternFromRow).filter(present),
    actions: (actions.data ?? []).map(actionFromRow).filter(present),
  };
}

export async function fetchLotHourly(lotCode: string): Promise<HourlyPoint[]> {
  const { data, error } = await db().from("dikw_information_lot_hourly").select("*").eq("lot_code", lotCode).order("hour_of_day");
  if (error) fail(error);
  return (data ?? []).map(hourlyFromRow).filter(present);
}

/** Totals across all drivers. The function returns counts and sums only, never another driver's rows. */
export async function fetchPlatformInsights(): Promise<PlatformInsights | null> {
  const { data, error } = await db().rpc("get_platform_insights");
  if (error) fail(error);
  return platformFromJson(data);
}

export async function fetchMyInsights(): Promise<MyInsights | null> {
  const { data, error } = await db().rpc("get_my_insights");
  if (error) fail(error);
  return mineFromJson(data);
}
