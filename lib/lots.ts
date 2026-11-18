import type { Tables } from "./database.types";
import type { DemoLot } from "./demo-lots";

/** One row of the public.lot_overview view. */
export type LotRow = Tables<"lot_overview">;

function hoursLabel(open: string, close: string): string {
  const from = open.slice(0, 5);
  const to = close.slice(0, 5);
  return from === "00:00" && to === "24:00" ? "24 hours" : `${from}–${to}`;
}

/** Database row -> the lot shape the screens already use. An incomplete row gives null. */
export function lotFromRow(row: LotRow): DemoLot | null {
  if (row.id === null || !row.code || !row.name || row.latitude === null || row.longitude === null || !row.total_spots) {
    return null;
  }
  const total = row.total_spots;
  return {
    id: row.code,
    dbId: row.id,
    name: row.name,
    addr: row.address ?? "",
    op: row.operator_name ?? "",
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    total,
    avail: Math.max(0, Math.min(total, row.available_spots ?? 0)),
    bookableFree: Number(row.bookable_bays_free ?? 0),
    price: Number(row.hourly_rate ?? 0),
    daily: row.daily_max === null ? 0 : Number(row.daily_max),
    hours: hoursLabel(row.open_time ?? "00:00", row.close_time ?? "24:00"),
    ev: row.ev_chargers ?? 0,
    disabled: row.accessible_spots ?? 0,
    covered: Boolean(row.is_covered),
    security: Boolean(row.has_security),
    freeWithPurchase: Boolean(row.free_with_purchase),
    rating: Number(row.rating ?? 0),
  };
}

export function lotsFromRows(rows: LotRow[]): DemoLot[] {
  return rows.map(lotFromRow).filter((lot): lot is DemoLot => lot !== null);
}
