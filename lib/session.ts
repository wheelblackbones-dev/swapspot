export type SpotState = "free" | "occ" | "booked" | "mine";
export type SpotType = "standard" | "ev" | "accessible";
// dbId and type are set for spots loaded from the database (public.parking_spots).
export type Spot = { id: string; state: SpotState; dbId?: number; type?: SpotType };
export type ParkingSession = { lotId: string; spotId: string; startedAt: number; durationMs: number };

export function createDemoSpots(availabilityRatio: number): Spot[] {
  return Array.from({ length: 12 }, (_, index) => {
    const random = Math.random();
    const state: SpotState = random < 1 - availabilityRatio ? "occ" : random < 1 - availabilityRatio + 0.12 ? "booked" : "free";
    return { id: `P${index + 1}`, state };
  });
}

export function sessionRemaining(session: ParkingSession, now: number): number {
  return Math.max(0, Math.min(session.durationMs, session.durationMs - (now - session.startedAt)));
}
