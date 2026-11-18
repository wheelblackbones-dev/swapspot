// DIKW insights: reads the dikw_* views and the two insight functions of the database,
// and works out the few things the Insights screen derives on the device.
//
//   Data        -> dikw_data_summary
//   Information -> dikw_information_city_hourly / dikw_information_lot_hourly
//   Knowledge   -> dikw_knowledge_lot_patterns
//   Wisdom      -> dikw_wisdom_lot_actions
//   plus get_platform_insights() (totals for operators) and get_my_insights() (the signed-in driver)

import { asList, asNumber, asRecord, asText, oneOf } from "./coerce";
import type { DemoLot } from "./demo-lots";
import { isOpen } from "./display";
import { availabilityStatus, distanceKm, type Coordinates } from "./parking";

export type DataSummary = { operators: number; lots: number; bays: number; sensorReadings: number; lastReadingAt: string | null };
export type HourlyPoint = { hour: number; occupancyPct: number; readings: number; availableSpots: number | null };
export type DemandLevel = "high" | "balanced" | "low";
export type OperatorAction = "raise_peak_price" | "promote_off_peak" | "keep_price";

export type LotPattern = {
  lotCode: string;
  lotName: string;
  hourlyRate: number;
  peakHour: number;
  peakPct: number;
  quietHour: number;
  quietPct: number;
  weekdayPct: number;
  weekendPct: number;
  demandLevel: DemandLevel;
};

export type LotAction = {
  lotCode: string;
  lotName: string;
  operatorAction: OperatorAction;
  operatorTip: string;
  driverTip: string;
};

export type PublicInsights = {
  summary: DataSummary | null;
  cityHourly: HourlyPoint[];
  patterns: LotPattern[];
  actions: LotAction[];
};

export type Advice = { title: string; detail: string };

export type PlatformInsights = {
  data: { users: number; bookings: number; payments: number; searchEvents: number };
  information: {
    bookingsPaid: number;
    revenue: number;
    averageTicket: number | null;
    averageHours: number | null;
    paymentSuccessRate: number | null;
    byLot: { lotName: string; bookings: number; revenue: number }[];
    byIntent: { intent: string; searches: number }[];
  };
  knowledge: { conversionRate: number | null; busiestBookingHour: number | null; topLot: string | null; preferredMethod: string | null };
  wisdom: Advice[];
};

export type MyInsights = {
  data: { bookings: number; payments: number; searchEvents: number };
  information: { bookingsPaid: number; totalSpent: number; hoursBooked: number; favouriteLot: string | null; favouriteLotVisits: number | null };
  knowledge: { usualHour: number | null; usualDayType: string | null; topIntent: string | null };
  wisdom: Advice[];
};

export const LEVEL_NAMES: Record<DemandLevel, string> = { high: "High demand", balanced: "Balanced", low: "Low demand" };
export const ACTION_TITLES: Record<OperatorAction, string> = {
  raise_peak_price: "Raise the peak-hour price",
  promote_off_peak: "Fill the empty spaces",
  keep_price: "Keep the price",
};

export function summaryFromRow(value: unknown): DataSummary | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    operators: asNumber(row.operators) ?? 0,
    lots: asNumber(row.lots) ?? 0,
    bays: asNumber(row.bays) ?? 0,
    sensorReadings: asNumber(row.sensor_readings) ?? 0,
    lastReadingAt: asText(row.last_reading_at),
  };
}

export function hourlyFromRow(value: unknown): HourlyPoint | null {
  const row = asRecord(value);
  const hour = row ? asNumber(row.hour_of_day) : null;
  const occupancyPct = row ? asNumber(row.avg_occupancy_pct) : null;
  if (!row || hour === null || occupancyPct === null || hour < 0 || hour > 23) return null;
  return { hour, occupancyPct, readings: asNumber(row.readings) ?? 0, availableSpots: asNumber(row.avg_available_spots) };
}

export function patternFromRow(value: unknown): LotPattern | null {
  const row = asRecord(value);
  if (!row) return null;
  const lotCode = asText(row.lot_code);
  const lotName = asText(row.lot_name);
  const demandLevel = oneOf<DemandLevel>(row.demand_level, ["high", "balanced", "low"]);
  const peakHour = asNumber(row.peak_hour);
  const quietHour = asNumber(row.quiet_hour);
  if (!lotCode || !lotName || !demandLevel || peakHour === null || quietHour === null) return null;
  return {
    lotCode, lotName, demandLevel, peakHour, quietHour,
    hourlyRate: asNumber(row.hourly_rate) ?? 0,
    peakPct: asNumber(row.peak_occupancy_pct) ?? 0,
    quietPct: asNumber(row.quiet_occupancy_pct) ?? 0,
    weekdayPct: asNumber(row.weekday_occupancy_pct) ?? 0,
    weekendPct: asNumber(row.weekend_occupancy_pct) ?? 0,
  };
}

export function actionFromRow(value: unknown): LotAction | null {
  const row = asRecord(value);
  if (!row) return null;
  const lotCode = asText(row.lot_code);
  const lotName = asText(row.lot_name);
  const operatorAction = oneOf<OperatorAction>(row.operator_action, ["raise_peak_price", "promote_off_peak", "keep_price"]);
  if (!lotCode || !lotName || !operatorAction) return null;
  return { lotCode, lotName, operatorAction, operatorTip: asText(row.operator_tip) ?? "", driverTip: asText(row.driver_tip) ?? "" };
}

function adviceList(value: unknown): Advice[] {
  return asList(value).flatMap((item) => {
    const row = asRecord(item);
    const title = row ? asText(row.title) : null;
    return row && title ? [{ title, detail: asText(row.detail) ?? "" }] : [];
  });
}

/** Reads the JSON of get_platform_insights(). */
export function platformFromJson(value: unknown): PlatformInsights | null {
  const root = asRecord(value);
  const data = root ? asRecord(root.data) : null;
  const information = root ? asRecord(root.information) : null;
  const knowledge = root ? asRecord(root.knowledge) : null;
  if (!root || !data || !information || !knowledge) return null;
  return {
    data: {
      users: asNumber(data.users) ?? 0,
      bookings: asNumber(data.bookings) ?? 0,
      payments: asNumber(data.payments) ?? 0,
      searchEvents: asNumber(data.search_events) ?? 0,
    },
    information: {
      bookingsPaid: asNumber(information.bookings_paid) ?? 0,
      revenue: asNumber(information.revenue) ?? 0,
      averageTicket: asNumber(information.average_ticket),
      averageHours: asNumber(information.average_hours),
      paymentSuccessRate: asNumber(information.payment_success_rate),
      byLot: asList(information.by_lot).flatMap((item) => {
        const row = asRecord(item);
        const lotName = row ? asText(row.lot_name) : null;
        return row && lotName ? [{ lotName, bookings: asNumber(row.bookings) ?? 0, revenue: asNumber(row.revenue) ?? 0 }] : [];
      }),
      byIntent: asList(information.by_intent).flatMap((item) => {
        const row = asRecord(item);
        const intent = row ? asText(row.intent) : null;
        return row && intent ? [{ intent, searches: asNumber(row.searches) ?? 0 }] : [];
      }),
    },
    knowledge: {
      conversionRate: asNumber(knowledge.conversion_rate),
      busiestBookingHour: asNumber(knowledge.busiest_booking_hour),
      topLot: asText(knowledge.top_lot),
      preferredMethod: asText(knowledge.preferred_method),
    },
    wisdom: adviceList(root.wisdom),
  };
}

/** Reads the JSON of get_my_insights(). */
export function mineFromJson(value: unknown): MyInsights | null {
  const root = asRecord(value);
  const data = root ? asRecord(root.data) : null;
  const information = root ? asRecord(root.information) : null;
  const knowledge = root ? asRecord(root.knowledge) : null;
  if (!root || !data || !information || !knowledge) return null;
  return {
    data: {
      bookings: asNumber(data.bookings) ?? 0,
      payments: asNumber(data.payments) ?? 0,
      searchEvents: asNumber(data.search_events) ?? 0,
    },
    information: {
      bookingsPaid: asNumber(information.bookings_paid) ?? 0,
      totalSpent: asNumber(information.total_spent) ?? 0,
      hoursBooked: asNumber(information.hours_booked) ?? 0,
      favouriteLot: asText(information.favourite_lot),
      favouriteLotVisits: asNumber(information.favourite_lot_visits),
    },
    knowledge: {
      usualHour: asNumber(knowledge.usual_hour),
      usualDayType: asText(knowledge.usual_day_type),
      topIntent: asText(knowledge.top_intent),
    },
    wisdom: adviceList(root.wisdom),
  };
}

/** The fullest hour of a series, or null when there are no readings. */
export function peakOf(points: HourlyPoint[]): HourlyPoint | null {
  return points.reduce<HourlyPoint | null>((best, point) => (!best || point.occupancyPct > best.occupancyPct ? point : best), null);
}

/** City-wide knowledge worked out from the hourly information and the per-lot patterns. */
export function cityKnowledge(insights: PublicInsights) {
  const daytime = insights.cityHourly.filter((point) => point.hour >= 8 && point.hour <= 21);
  const busiest = peakOf(daytime);
  const calmest = daytime.reduce<HourlyPoint | null>((best, point) => (!best || point.occupancyPct < best.occupancyPct ? point : best), null);
  const count = insights.patterns.length;
  const mean = (pick: (pattern: LotPattern) => number) => (count ? insights.patterns.reduce((sum, pattern) => sum + pick(pattern), 0) / count : 0);
  const levels = { high: 0, balanced: 0, low: 0 };
  for (const pattern of insights.patterns) levels[pattern.demandLevel] += 1;
  return { busiest, calmest, weekdayPct: mean((pattern) => pattern.weekdayPct), weekendPct: mean((pattern) => pattern.weekendPct), levels };
}

/** The hour of the day in Bangkok, where the lots are and where the sensor history is grouped. */
export function bangkokHour(now: number): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).format(new Date(now)));
}

/** "Right now" advice: the nearest open lot with free space, preferring one that is not filling up. */
export function bestLotNow(lots: DemoLot[], location: Coordinates, radiusKm: number, now = new Date()): DemoLot | null {
  const near = lots
    .filter((lot) => isOpen(lot, now) && lot.avail > 0 && distanceKm(location, lot) <= radiusKm)
    .sort((a, b) => distanceKm(location, a) - distanceKm(location, b));
  return near.find((lot) => availabilityStatus(lot) === "ok") ?? near[0] ?? null;
}
