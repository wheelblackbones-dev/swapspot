// Small text formatters shared by the booking, checkout, account and insights screens.

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatNumber(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US");
}

/** ฿60, ฿1,250 or ฿12.50 */
export function baht(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `฿${Number.isInteger(amount)
    ? amount.toLocaleString("en-US")
    : amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 09:59 below one hour, 2:59:59 above it. Never negative. */
export function countdown(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
}

/** 8 -> 08:00 */
export function hourLabel(hour: number): string {
  return `${pad2(hour)}:00`;
}

/** Clock time on this device, e.g. 14:05 */
export function clockTime(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 18 Nov, 14:05 */
export function dayAndTime(iso: string): string {
  return `${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${clockTime(iso)}`;
}

/** "just now", "5 min ago", "3 h ago", "2 d ago" — or "never" when there is no timestamp. */
export function timeAgo(iso: string | null, now: number): string {
  if (!iso) return "never";
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes)) return "never";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}
