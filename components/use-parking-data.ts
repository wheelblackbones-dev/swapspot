"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backendReady, fetchLots, fetchSpots } from "@/lib/backend";
import { createDemoLots, type DemoLot } from "@/lib/demo-lots";
import { createDemoSpots, type Spot } from "@/lib/session";

/** "live": lots come from the database · "demo": built-in sample lots · "loading": first answer not in yet */
export type DataMode = "loading" | "live" | "demo";

const LOTS_REFRESH_MS = 20000;
const SPOTS_REFRESH_MS = 10000;
const DEMO_DRIFT_MS = 6000;

/**
 * The parking lots: loaded from the database and refreshed while the page is visible.
 * If the database cannot be reached (or has no lots yet) the built-in sample lots are
 * used instead, with the simulated availability changes of the original demo.
 */
export function useParkingData(live: boolean, onModeChange: (mode: DataMode, reason: string, previous: DataMode) => void) {
  const [lots, setLots] = useState<DemoLot[]>(createDemoLots);
  const [mode, setMode] = useState<DataMode>(backendReady ? "loading" : "demo");
  const [reason, setReason] = useState(backendReady ? "" : "The database connection is not set up");
  const busy = useRef(false);
  const failures = useRef(0);
  const lastMode = useRef<DataMode>(backendReady ? "loading" : "demo");
  const notify = useRef(onModeChange);

  useEffect(() => {
    notify.current = onModeChange;
  }, [onModeChange]);

  const reload = useCallback(async () => {
    if (!backendReady || busy.current) return;
    busy.current = true;
    let next: DataMode = "demo";
    let why = "The database cannot be reached";
    try {
      const rows = await fetchLots();
      if (rows.length) {
        next = "live";
        why = "";
        setLots(rows);
      } else {
        why = "The database has no parking lots yet";   // connected, but the sample data has not been loaded
      }
      failures.current = 0;
    } catch (error) {
      console.warn("SwapSpot data:", error);
      failures.current += 1;
      // One missed refresh is not worth leaving the database for: keep the last answer and try again.
      if (lastMode.current === "live" && failures.current < 2) return;
    } finally {
      busy.current = false;
    }
    setMode(next);
    setReason(why);
    if (next !== lastMode.current) {
      const previous = lastMode.current;
      lastMode.current = next;
      notify.current(next, why, previous);
    }
  }, []);

  // First load, and again whenever the tab comes back into view.
  useEffect(() => {
    if (!backendReady) return;
    const first = setTimeout(reload, 0);
    const onVisible = () => {
      if (!document.hidden) void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  // Keep the list fresh. Without the database, keep trying to reach it.
  useEffect(() => {
    if (!backendReady || (mode === "live" && !live)) return;
    const timer = setInterval(() => {
      if (!document.hidden) void reload();
    }, LOTS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [mode, live, reload]);

  // Built-in sample lots only: the simulated availability changes of the original demo.
  useEffect(() => {
    if (mode !== "demo" || !live) return;
    const timer = setInterval(() => {
      setLots((current) => current.map((lot) => {
        const drift = (Math.random() - 0.48) * Math.max(3, lot.total * 0.004);
        return { ...lot, avail: Math.max(0, Math.min(lot.total, Math.round(lot.avail + drift))) };
      }));
    }, DEMO_DRIFT_MS);
    return () => clearInterval(timer);
  }, [mode, live]);

  return { lots, mode, reason, reload };
}

/**
 * The spots of one lot. With the database: rows of public.parking_spots, refreshed while the
 * spot screen is open. Without it: twelve generated spots, as in the original demo.
 * Returns null until the first answer is in.
 */
export function useSpots(lot: DemoLot | null, mode: DataMode, watching: boolean) {
  const [liveSpots, setLiveSpots] = useState<Record<string, Spot[]>>({});
  const [demoSpots, setDemoSpots] = useState<Record<string, Spot[]>>({});
  const lotId = lot?.id ?? null;
  const dbId = lot?.dbId;
  const fromDatabase = mode === "live" && dbId !== undefined;
  const demoRatio = lot ? lot.avail / lot.total : 0;
  const ratio = useRef(demoRatio);

  useEffect(() => {
    ratio.current = demoRatio;
  }, [demoRatio]);

  const reload = useCallback(async () => {
    if (!lotId) return;
    if (!fromDatabase || dbId === undefined) {
      setDemoSpots((current) => (current[lotId] ? current : { ...current, [lotId]: createDemoSpots(ratio.current) }));
      return;
    }
    try {
      const rows = await fetchSpots(dbId);
      setLiveSpots((current) => ({ ...current, [lotId]: rows }));
    } catch (error) {
      console.warn("SwapSpot spots:", error);
    }
  }, [lotId, dbId, fromDatabase]);

  useEffect(() => {
    if (!watching || !lotId) return;
    const first = setTimeout(reload, 0);
    const timer = fromDatabase
      ? setInterval(() => {
          if (!document.hidden) void reload();
        }, SPOTS_REFRESH_MS)
      : null;
    return () => {
      clearTimeout(first);
      if (timer) clearInterval(timer);
    };
  }, [watching, lotId, fromDatabase, reload]);

  const spots = lotId ? (fromDatabase ? liveSpots[lotId] : demoSpots[lotId]) ?? null : null;
  return { spots, reload };
}
