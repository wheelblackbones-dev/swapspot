// Small readers for values that arrive from the database as JSON.
// Anything of the wrong type becomes null instead of being trusted.

export function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Numbers, and numeric strings such as the "60.00" a numeric column can arrive as. */
export function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}
