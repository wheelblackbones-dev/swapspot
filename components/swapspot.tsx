"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  backendReady, cancelBooking, confirmDemoPayment, createBooking, endBooking, fetchBookings, fetchLiveBooking, logSearch,
  saveProfile, signIn, signOut, signUp, startPayment, type Profile, type SearchSource,
} from "@/lib/backend";
import {
  describeSession, liveRemaining, liveState, openPaymentOf, shownSpotState,
  type Booking, type Payment, type PaymentMethod,
} from "@/lib/booking";
import type { DemoLot } from "@/lib/demo-lots";
import { formatPrice, isOpen, lotDistance, statusLabel } from "@/lib/display";
import { baht, clockTime, countdown } from "@/lib/format";
import { parseIntent, searchKind, type SearchKind } from "@/lib/intent";
import { distanceKm, matchesPreferences, type Coordinates } from "@/lib/parking";
import { sessionRemaining, type ParkingSession } from "@/lib/session";
import { defaultSettings, parseSettings, SETTINGS_KEY, type Settings } from "@/lib/settings";
import { AccountView } from "./account-view";
import { AuthView } from "./auth-view";
import { CameraView } from "./camera-view";
import { CheckoutView } from "./checkout-view";
import { DetailView } from "./detail-view";
import { DriveView } from "./drive-view";
import { Icon } from "./icon";
import { InsightsView } from "./insights-view";
import { MapView, type LotFilter } from "./map-view";
import { NavigationView } from "./navigation-view";
import { SettingsView } from "./settings-view";
import { SpotsView, type ShownSpot } from "./spots-view";
import { displayName, useAccount } from "./use-account";
import { useParkingData, useSpots, type DataMode } from "./use-parking-data";
import { useSpeech } from "./use-speech";

type View = "drive" | "map" | "detail" | "nav" | "settings" | "spots" | "camera" | "auth" | "account" | "checkout" | "insights";
const views: View[] = ["drive", "map", "detail", "nav", "settings", "spots", "camera", "auth", "account", "checkout", "insights"];
const initialLocation = { lat: 13.746, lng: 100.535 };
const BOOKING_REFRESH_MS = 30000;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");
const loadHistory = () => fetchBookings(20);

export function SwapSpot() {
  const [view, setView] = useState<View>("drive");
  const [location, setLocation] = useState<Coordinates>(initialLocation);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LotFilter>("all");
  const [live, setLive] = useState(true);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("Demo ready. Tap the button or say “Hey SwapSpot” to ask for parking.");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  // The built-in simulation of the original demo. Only used while the database is not connected.
  const [session, setSession] = useState<ParkingSession | null>(null);
  // This driver's booking in the database, and the payment attempt that is open for it.
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod | null>(null);
  const [paymentRetry, setPaymentRetry] = useState(0);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ lotId: string; spotId: string } | null>(null);
  const [hours, setHours] = useState(2);
  const [now, setNow] = useState(() => Date.now());
  const [clockOffset, setClockOffset] = useState(0);   // database clock minus this device's clock, in milliseconds
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handler = useRef<(text: string) => void>(() => {});
  const viewRef = useRef<View>("drive");
  const afterAuth = useRef<{ view: View; lotId?: string } | null>(null);
  const bookingVersion = useRef(0);
  const paymentRequest = useRef("");
  const endArmedUntil = useRef(0);
  const alerted = useRef(false);

  const showToast = useCallback((message: string, ms = 3000) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  }, []);

  const speech = useSpeech({
    voiceOut: settings.voiceOut,
    muted: settings.muted,
    wakeWord: settings.wakeWord,
    voiceName: settings.voiceName,
    rate: settings.rate,
    expectingResponse: pending !== null,
    onCommand: (text) => handler.current(text),
    onError: showToast,
  });
  const { speak, start: startListening, stop: stopListening, cancelSpeech, setTranscript } = speech;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      // Browser storage is only available after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSettings(parseSettings(saved));
    } catch (error) {
      console.warn("Could not load saved settings", error);
      showToast("Could not load saved settings; using defaults.");
    }
    setSettingsLoaded(true);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (queryTimer.current) clearTimeout(queryTimer.current);
    };
  }, [showToast]);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Could not save settings", error);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast("Could not save settings on this device.");
    }
    document.body.classList.toggle("light", settings.lightTheme);
  }, [settings, settingsLoaded, showToast]);

  useEffect(() => {
    const syncHash = () => {
      const value = window.location.hash.slice(1);
      if (views.includes(value as View)) setView(value as View);
      else if (!value) setView("drive");
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const go = useCallback((next: View) => {
    setView(next);
    window.location.hash = next;
  }, []);

  const say = useCallback((text: string) => {
    setAnswer(text);
    speak(text);
  }, [speak]);

  /* ---------- parking data: the database, or the built-in sample lots when it cannot be reached ---------- */

  const announceMode = useCallback((mode: DataMode, reason: string, previous: DataMode) => {
    if (mode === "live") {
      setSession(null);   // the simulation ends where the database takes over
      if (previous === "demo") showToast("Connected. Parking data now comes from the database.");
    } else if (mode === "demo") {
      showToast(`${reason}. Showing the built-in demo data.`, 4200);
    }
  }, [showToast]);
  const { lots, mode: dataMode, reason: demoReason, reload: reloadLots } = useParkingData(live, announceMode);
  const usesDatabase = dataMode === "live";

  const selected = lots.find((lot) => lot.id === selectedId) ?? null;
  const matchingLots = useMemo(() => lots
    .filter((lot) => matchesPreferences(lot, location, settings))
    .sort((a, b) => distanceKm(location, a) - distanceKm(location, b)), [lots, location, settings]);
  const visibleLots = useMemo(() => matchingLots.filter((lot) => {
    if (query && !`${lot.name} ${lot.addr}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "open" && !isOpen(lot)) return false;
    if (filter === "free" && lot.price !== 0) return false;
    if (filter === "ev" && !lot.ev) return false;
    if (filter === "disabled" && !lot.disabled) return false;
    if (filter === "covered" && !lot.covered) return false;
    return filter !== "cheap" || lot.price <= 40;
  }), [matchingLots, filter, query]);
  const { spots, reload: reloadSpots } = useSpots(selected, dataMode, view === "spots");

  const selectLot = useCallback((id: string) => setSelectedId(id), []);

  const openAction = useCallback((action: "nav" | "spots" | "camera" | "detail") => {
    if (!selected) {
      showToast("Choose a demo lot first.");
      return;
    }
    if (action === "nav") say("This is a simulated route preview, not driving directions.");
    go(action);
  }, [selected, showToast, say, go]);

  /* ---------- account and the booking in progress ---------- */

  /** Replaces the booking after an action on this device, so a slower background refresh cannot undo it. */
  const applyBooking = useCallback((next: Booking | null) => {
    bookingVersion.current += 1;
    setBooking(next);
    setNow(Date.now());
  }, []);

  const refreshBooking = useCallback(async () => {
    if (!backendReady) return;
    const version = bookingVersion.current;
    try {
      const latest = await fetchLiveBooking();
      if (version !== bookingVersion.current) return;
      setBooking(latest && liveState(latest, Date.now() + clockOffset) ? latest : null);
      setNow(Date.now());
    } catch (error) {
      console.warn("SwapSpot booking:", error);
    }
  }, [clockOffset]);

  const { account, profile, setProfile } = useAccount({
    onSignIn: () => {
      void refreshBooking();
      if (viewRef.current !== "auth") return;   // only move on if the driver is still waiting on the sign-in screen
      const next = afterAuth.current;
      afterAuth.current = null;
      if (next?.lotId) setSelectedId(next.lotId);
      go(next?.view ?? "account");
    },
    onSignOut: () => {
      applyBooking(null);
      setPayment(null);
      setChosenMethod(null);
      setPick(null);
      if (viewRef.current === "account" || viewRef.current === "checkout") go("drive");
    },
  });
  const accountId = account?.id ?? null;
  const driverName = displayName(account, profile);

  useEffect(() => {
    if (!accountId) return;
    const refresh = () => {
      if (!document.hidden) void refreshBooking();
    };
    const timer = setInterval(refresh, BOOKING_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accountId, refreshBooking]);

  // One clock for every countdown on screen.
  const ticking = booking !== null || session !== null;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  const serverNow = now + clockOffset;
  const bookingState = liveState(booking, serverNow);

  const expireBooking = useCallback((expired: Booking) => {
    applyBooking(null);
    setPayment(null);
    setChosenMethod(null);
    if (expired.status === "pending_payment") {
      showToast("Your 10 minute hold ran out. The spot was released.", 4200);
    } else {
      say(`Time is up. Your parking at ${expired.lotName} has ended. Thank you for using SwapSpot.`);
      showToast("Parking time is up");
    }
    if (viewRef.current === "checkout") {
      setSelectedId(expired.lotCode);
      go("spots");
    }
    void reloadSpots();
    void reloadLots();
  }, [applyBooking, showToast, say, go, reloadSpots, reloadLots]);

  useEffect(() => {
    if (!booking) return;
    const timer = setInterval(() => {
      const at = Date.now() + clockOffset;
      if (!liveState(booking, at)) {
        expireBooking(booking);   // the hold or the session just ran out
        return;
      }
      const left = liveRemaining(booking, at);
      if (booking.status === "active" && !alerted.current && left <= 15 * 60000 && left > 14 * 60000) {
        alerted.current = true;
        say(`15 minutes left on your parking at ${booking.lotName}.`);
        showToast(`15 minutes left at ${booking.spotLabel}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [booking, clockOffset, expireBooking, say, showToast]);

  const openMyBooking = useCallback(() => {
    if (!booking) return;
    const state = liveState(booking, Date.now() + clockOffset);
    if (!state) return;
    setSelectedId(booking.lotCode);
    go(state === "pending" ? "checkout" : "spots");
  }, [booking, clockOffset, go]);

  /* ---------- built-in simulation (database not connected) ---------- */

  const endSession = useCallback((expired = false) => {
    if (!session) return;
    const lot = lots.find((item) => item.id === session.lotId);
    const cost = Math.max(0, Math.round((Date.now() - session.startedAt) / 3600000 * (lot?.price ?? 0)));
    setSession(null);
    say(`${expired ? "Demo time is up. " : ""}Demo parking ended. Estimated fee ${cost} baht.`);
    showToast(`Demo parking ended · estimated ฿${cost}`);
  }, [session, lots, say, showToast]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      if (sessionRemaining(session, Date.now()) === 0) endSession(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [session, endSession]);

  /* ---------- the spot screen ---------- */

  const shownSpots: ShownSpot[] | null = selected && spots
    ? spots.map((spot) => {
        const shown = shownSpotState(spot, selected.id, booking, session, serverNow);
        return { ...spot, shown, picked: shown === "free" && pick?.lotId === selected.id && pick.spotId === spot.id };
      })
    : null;
  const pickedSpot = shownSpots?.find((spot) => spot.picked) ?? null;
  const card = selected
    ? describeSession({
        mode: usesDatabase ? "live" : "demo",
        lot: selected,
        signedIn: account !== null,
        booking,
        session,
        sessionLotName: session ? lots.find((lot) => lot.id === session.lotId)?.name : undefined,
        pick: pickedSpot?.id ?? null,
        hours,
        now: usesDatabase ? serverNow : now,
      })
    : null;

  const tapSpot = useCallback((spotId: string) => {
    const spot = shownSpots?.find((item) => item.id === spotId);
    if (!selected || !spot) return;
    if (spot.shown === "occ") return showToast(`${spot.id} is occupied`);
    if (spot.shown === "booked") return showToast(`${spot.id} is booked by another driver`);
    if (spot.shown === "mine") {
      if (!usesDatabase) return endSession();
      if (bookingState === "pending") return go("checkout");
      return showToast("This is your spot. The timer is below.");
    }
    if (usesDatabase ? bookingState : session) {
      return showToast(usesDatabase ? "You already have a booking in progress." : "End the current demo session before choosing another spot.");
    }
    setPick((current) => (current && current.lotId === selected.id && current.spotId === spotId ? null : { lotId: selected.id, spotId }));
  }, [shownSpots, selected, usesDatabase, bookingState, session, showToast, endSession, go]);

  const bookPicked = useCallback(async (spotDbId: number) => {
    setBusy(true);
    try {
      const created = await createBooking(spotDbId, hours);
      setClockOffset(Date.parse(created.createdAt) - Date.now());
      applyBooking(created);
      setPayment(null);
      setChosenMethod(null);
      setCheckoutMessage("");
      setPick(null);
      paymentRequest.current = "";
      alerted.current = false;
      if (created.status === "active") {   // free with a purchase: nothing to pay
        say(`Spot ${created.spotLabel} booked at ${created.lotName}. It is free with a purchase. The timer has started.`);
        showToast(`Booked ${created.spotLabel}`);
        void reloadSpots();
      } else {
        say(`Spot ${created.spotLabel} is held for 10 minutes. Pay to confirm it.`);
        go("checkout");
      }
    } catch (error) {
      showToast(messageOf(error), 3600);
      void reloadSpots();
    } finally {
      setBusy(false);
    }
  }, [hours, applyBooking, say, showToast, go, reloadSpots]);

  const endParking = useCallback(async (current: Booking) => {
    if (Date.now() > endArmedUntil.current) {   // ending cannot be undone, so it takes two taps
      endArmedUntil.current = Date.now() + 5000;
      showToast("Tap End again to finish. Unused time is not refunded.", 4200);
      return;
    }
    endArmedUntil.current = 0;
    setBusy(true);
    try {
      const done = await endBooking(current.id);
      applyBooking(null);
      say(`Parking ended at ${done.spotLabel}. ${done.amount === 0 ? "" : `You paid ${done.amount} baht. `}Thank you for using SwapSpot.`);
      showToast("Parking ended");
      void reloadSpots();
      void reloadLots();
    } catch (error) {
      showToast(messageOf(error), 3600);
      void refreshBooking();
    } finally {
      setBusy(false);
    }
  }, [applyBooking, say, showToast, reloadSpots, reloadLots, refreshBooking]);

  const pressSessionButton = useCallback(() => {
    if (!selected || !card || busy) return;
    if (card.action === "signin") {
      afterAuth.current = { view: "spots", lotId: selected.id };
      showToast("Sign in to book a spot.");
      go("auth");
    } else if (card.action === "pay") {
      go("checkout");
    } else if (card.action === "book" && pickedSpot?.dbId !== undefined) {
      void bookPicked(pickedSpot.dbId);
    } else if (card.action === "end" && booking) {
      void endParking(booking);
    } else if (card.action === "demo-park" && pickedSpot) {
      setSession({ lotId: selected.id, spotId: pickedSpot.id, startedAt: Date.now(), durationMs: hours * 3600000 });
      setNow(Date.now());
      setPick(null);
      say(`Demo spot ${pickedSpot.id} selected at ${selected.name}. No real reservation was made.`);
      showToast(`Demo spot ${pickedSpot.id} selected`);
    } else if (card.action === "demo-end") {
      endSession();
    }
  }, [selected, card, busy, pickedSpot, booking, hours, showToast, go, bookPicked, endParking, say, endSession]);

  const cancelMyBooking = useCallback(async () => {
    if (!booking || busy || liveState(booking, Date.now() + clockOffset) !== "pending") return;
    setBusy(true);
    try {
      await cancelBooking(booking.id);
      applyBooking(null);
      setPayment(null);
      setChosenMethod(null);
      paymentRequest.current = "";
      showToast("Booking cancelled. The spot is free again.");
      setSelectedId(booking.lotCode);
      go("spots");
      void reloadSpots();
    } catch (error) {
      showToast(messageOf(error), 3600);
      void refreshBooking();
    } finally {
      setBusy(false);
    }
  }, [booking, busy, clockOffset, applyBooking, showToast, go, reloadSpots, refreshBooking]);

  /* ---------- checkout: simulated payment, recorded in public.payments ---------- */

  // After a reload the booking row itself says which payment attempt is still open; pick that one up.
  const carried = booking ? openPaymentOf(booking) : null;
  const ownPayment = booking && payment && payment.bookingId === booking.id ? payment : null;
  const method: PaymentMethod = chosenMethod ?? ownPayment?.method ?? carried?.method ?? "promptpay_qr";
  const currentPayment = ownPayment
    ? (ownPayment.method === method && ownPayment.status === "pending" ? ownPayment : null)
    : carried && carried.method === method ? carried : null;
  const bookingId = booking?.id ?? null;
  const needsPayment = view === "checkout" && bookingState === "pending" && !currentPayment;

  useEffect(() => {
    if (!needsPayment || bookingId === null) return;
    const key = `${bookingId}:${method}:${paymentRetry}`;
    if (paymentRequest.current === key) return;
    paymentRequest.current = key;
    startPayment(bookingId, method)
      .then((next) => {
        if (paymentRequest.current === key) setPayment(next);
      })
      .catch((error: unknown) => {
        if (paymentRequest.current === key) setCheckoutMessage(messageOf(error));
      });
  }, [needsPayment, bookingId, method, paymentRetry]);

  const chooseMethod = useCallback((next: PaymentMethod) => {
    if (busy) return;
    setCheckoutMessage("");
    if (next === method) setPaymentRetry((value) => value + 1);   // tapping the same method again retries a failed start
    else setChosenMethod(next);
  }, [busy, method]);

  const finishPayment = useCallback(async (outcome: "succeeded" | "failed") => {
    if (busy || !currentPayment) return;
    setBusy(true);
    setCheckoutMessage("");
    try {
      const result = await confirmDemoPayment(currentPayment.id, outcome);
      paymentRequest.current = "";
      setPayment(null);
      applyBooking(result);
      if (result.status === "active") {
        if (result.startsAt) setClockOffset(Date.parse(result.startsAt) - Date.now());
        alerted.current = false;
        say(`Payment received. Spot ${result.spotLabel} at ${result.lotName} is yours for ${result.durationHours} ${result.durationHours === 1 ? "hour" : "hours"}. This was a demo payment, so no money was taken.`);
        showToast(`Paid ${baht(result.amount)} · ${result.spotLabel} confirmed`);
        void reloadLots();
      } else {
        setCheckoutMessage("Payment declined (simulated). Nothing was charged. Try again or switch method.");
      }
    } catch (error) {
      setCheckoutMessage(messageOf(error));
      paymentRequest.current = "";
      setPayment(null);
      void refreshBooking();
    } finally {
      setBusy(false);
    }
  }, [busy, currentPayment, applyBooking, say, showToast, reloadLots, refreshBooking]);

  /* ---------- the assistant ---------- */

  const processQuery = useCallback((text: string, source: SearchSource) => {
    const intent = parseIntent(text, lots);
    // Demand signal for the Insights screen: only the kind of request of a signed-in driver, never the words.
    const track = (kind: SearchKind, lot?: DemoLot | null) => {
      if (account && usesDatabase) logSearch(source, kind, lot?.dbId);
    };
    if (pending && intent.yes && !intent.no && !intent.navigate) {
      const target = lots.find((lot) => lot.id === pending);
      setPending(null);
      if (target) {
        setSelectedId(target.id);
        say(`Showing a simulated route to ${target.name}. This is not driving navigation.`);
        go("nav");
      }
      return;
    }
    if (pending && intent.no && !intent.yes) {
      setPending(null);
      say("Okay, no demo route.");
      return;
    }
    setPending(null);
    if (intent.repeat) {
      say(speech.lastAnswer.current || "There is nothing to repeat yet.");
      return;
    }
    if (intent.insights) {
      say("Opening insights.");
      go("insights");
      return;
    }
    if (intent.account) {
      say(account ? "Opening your account." : "Please sign in to see your account.");
      go("account");
      return;
    }
    if (intent.pay) {
      if (liveState(booking, Date.now() + clockOffset) === "pending") {
        say("Opening checkout.");
        go("checkout");
      } else {
        say("You have nothing to pay right now.");
      }
      return;
    }
    if (intent.cancel) {
      if (view === "nav") go("drive");
      say("Demo navigation cancelled.");
      return;
    }
    if (intent.help) {
      say("Ask for nearby parking, prices, EV charging, accessible spots, a simulated route, your account, or insights.");
      return;
    }
    if (intent.greeting && !intent.nearest && !intent.navigate && !intent.lot) {
      say("Hello! This is a parking demonstration. Ask me to find parking or check prices.");
      return;
    }
    let position = location;
    if (intent.atLocation && intent.lot) {
      position = { lat: intent.lot.lat + 0.0022, lng: intent.lot.lng + 0.0015 };
      setLocation(position);
    }
    const radius = intent.maxDistance ?? settings.radius;
    let candidates = lots.filter((lot) =>
      (!intent.ev || lot.ev > 0) && (!intent.disabled || lot.disabled > 0) &&
      (!intent.covered || lot.covered) && (!intent.free || lot.price === 0) &&
      (intent.maxPrice === null || lot.price <= intent.maxPrice) && distanceKm(position, lot) <= radius,
    );
    candidates.sort((a, b) => (intent.cheapest ? a.price - b.price : 0) || distanceKm(position, a) - distanceKm(position, b));
    const open = candidates.filter((lot) => isOpen(lot));
    if (open.length) candidates = open;
    if (intent.lot && !intent.navigate && !intent.nearest && !intent.reserve) {
      const lot = intent.lot;
      track(intent.priceQuery ? "price_check" : "availability_check", lot);
      say(intent.priceQuery
        ? `Demo: ${lot.name} charges ${formatPrice(lot)}${lot.daily ? `, or ฿${lot.daily} daily maximum` : ""}.`
        : `Demo: ${lot.name} has ${lot.avail} of ${lot.total} simulated spots open. ${statusLabel(lot)}. ${formatPrice(lot)}.`);
      return;
    }
    if (intent.navigate) {
      const target = intent.lot ?? candidates.find((lot) => lot.avail > 0);
      if (!target) { say("No matching demo lot found."); return; }
      track("navigate", target);
      setSelectedId(target.id);
      say(`Showing a simulated route to ${target.name}. This is not driving navigation.`);
      go("nav");
      return;
    }
    if (intent.reserve) {
      const target = intent.lot ?? candidates.find((lot) => lot.avail > 0);
      if (!target) { say("No demo lot is available."); return; }
      track("reserve", target);
      setSelectedId(target.id);
      say(usesDatabase
        ? `Choose a spot at ${target.name} to hold it for 10 minutes. This is a demo booking: no real space is reserved.`
        : `Choose a demo spot at ${target.name}. No real space is reserved.`);
      go("spots");
      return;
    }
    const target = candidates.find((lot) => lot.avail > 0);
    track(searchKind(intent), target);
    if (!target) {
      say("No matching demo parking found. Try widening the search radius.");
      return;
    }
    setSelectedId(target.id);
    setPending(target.id);
    say(`Demo: ${target.name} has ${target.avail} simulated spots, ${formatPrice(target)}, ${lotDistance(target, position)} away. Show a simulated route? Say yes or no.`);
    go("map");
  }, [lots, account, usesDatabase, pending, booking, clockOffset, location, settings.radius, say, speech.lastAnswer, view, go]);

  const submitQuery = useCallback((text: string, source: SearchSource = "voice") => {
    setTranscript(text);
    setLoading(true);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => {
      setLoading(false);
      processQuery(text, source);
    }, 800);
  }, [processQuery, setTranscript]);

  useEffect(() => {
    handler.current = submitQuery;
  }, [submitQuery]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.code !== "Space" || event.repeat || (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)))) return;
      event.preventDefault();
      if (speech.listening) stopListening();
      else startListening();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [speech.listening, startListening, stopListening]);

  const changeSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "wakeWord") {
      if (value) startListening();
      else stopListening();
    }
  }, [startListening, stopListening]);

  const saveMyProfile = useCallback(async (fields: Profile) => {
    if (!accountId) return;
    setProfile(await saveProfile(accountId, fields));
  }, [accountId, setProfile]);

  const leaveAccount = useCallback(async () => {
    try {
      await signOut();
      showToast("Signed out");
    } catch (error) {
      showToast(messageOf(error));
    }
  }, [showToast]);

  const banner = booking && bookingState
    ? {
        time: countdown(liveRemaining(booking, serverNow)),
        title: `${bookingState === "pending" ? "Spot on hold" : "Parking"} · ${booking.spotLabel} at ${booking.lotName}`,
        note: bookingState === "pending"
          ? `Pay ${baht(booking.amount)} before the hold ends`
          : `${booking.endsAt ? `Until ${clockTime(booking.endsAt)}` : "In progress"}${booking.amount > 0 ? ` · paid ${baht(booking.amount)}` : ""}`,
        action: bookingState === "pending" ? "Pay" : "Open",
      }
    : null;
  const dataPill = {
    loading: { label: "Connecting…", tone: "", title: "Connecting to the SwapSpot database" },
    live: { label: "Database connected", tone: "on", title: "Lots, spots, bookings and payments are stored in the SwapSpot database. Sensor readings and payments are simulated." },
    demo: { label: "Offline demo data", tone: "warn", title: `${demoReason}. The built-in demo data is shown and nothing is saved.` },
  }[dataMode];

  return (
    <>
      <div id="app" data-view={view}>
        <header className="topbar">
          <div className="brand"><div className="brand-mark">P</div><span>Swap<b>Spot</b></span></div>
          <div className="status-pills"><div className="pill">Demo location</div><div className={`pill ${speech.listening ? "on" : ""}`}>Mic</div><div className={`pill ${speech.speaking ? "on" : ""}`}>Voice</div><div className={`pill ${dataPill.tone}`} id="pillData" data-mode={dataMode} title={dataPill.title}>{dataPill.label}</div></div>
          <button className="icon-btn" id="insightsBtn" title="Insights (DIKW)" aria-label="Insights" onClick={() => go("insights")}><Icon name="chart" /></button>
          <button className={`icon-btn ${account ? "signed" : ""}`} id="accountBtn" title={account ? "Your account" : "Sign in"} aria-label={account ? "Your account" : "Sign in"} onClick={() => go("account")}><Icon name="user" /><span className="acct-initial" id="acctInitial">{account ? (driverName || "?").trim().charAt(0).toUpperCase() : ""}</span></button>
          <button className={`icon-btn ${settings.muted ? "active" : ""}`} title="Mute voice" onClick={() => { changeSetting("muted", !settings.muted); if (!settings.muted) cancelSpeech(); }}><Icon name="volume" /></button>
          <button className="icon-btn" title="Settings" onClick={() => go("settings")}><Icon name="settings" /></button>
        </header>
        <div className="demo-banner">DEMO ONLY · No real reservations or driving directions</div>
        {!speech.supported && <div id="micWarn" className="show">Voice input is not supported. Type a request below.</div>}
        {view === "drive" && <DriveView nearest={matchingLots[0] ?? null} location={location} answer={answer} transcript={speech.transcript} listening={speech.listening} speaking={speech.speaking} banner={banner} onNearest={(id) => { setSelectedId(id); go("detail"); }} onMicrophone={() => speech.listening ? stopListening() : startListening()} onCommand={submitQuery} onBanner={openMyBooking} />}
        {view === "map" && <MapView allLots={lots} lots={visibleLots} location={location} selected={selected} filter={filter} query={query} live={live} pending={pending === selected?.id} onSelect={selectLot} onFilter={setFilter} onQuery={setQuery} onBack={() => go("drive")} onToggleLive={() => { setLive((value) => !value); showToast(`${usesDatabase ? "Database" : "Simulated"} updates ${live ? "paused" : "on"}.`); }} onLocate={() => showToast("Location is simulated.")} onAnswer={(value) => submitQuery(value, "chip")} onAction={openAction} />}
        {view === "settings" && <SettingsView settings={settings} voices={speech.voices} onChange={changeSetting} onBack={() => go("drive")} />}
        {view === "detail" && selected && <DetailView lot={selected} location={location} onBack={() => go("map")} onAction={openAction} />}
        {view === "nav" && selected && <NavigationView lot={selected} location={location} onCancel={() => go("drive")} />}
        {view === "spots" && selected && card && <SpotsView lot={selected} spots={shownSpots} demo={!usesDatabase} awaitingPayment={bookingState === "pending"} card={card} hours={hours} busy={busy} onBack={() => go("detail")} onSpot={tapSpot} onHours={setHours} onPrimary={pressSessionButton} onCancel={cancelMyBooking} onElsewhere={() => { if (usesDatabase) openMyBooking(); else if (card.elsewhere) setSelectedId(card.elsewhere.lotId); }} />}
        {view === "camera" && selected && <CameraView lot={selected} onBack={() => go("detail")} onBook={() => go("spots")} />}
        {(view === "auth" || view === "account") && !account && <AuthView ready={backendReady} onBack={() => { afterAuth.current = null; go("drive"); }} onSignIn={signIn} onSignUp={signUp} onWelcome={(name) => showToast(`Welcome to SwapSpot, ${name.split(" ")[0]}!`)} />}
        {(view === "auth" || view === "account") && account && <AccountView account={account} profile={profile} name={driverName} live={booking && bookingState ? { state: bookingState, booking, time: countdown(liveRemaining(booking, serverNow)) } : null} clockOffset={clockOffset} loadHistory={loadHistory} onBack={() => go("drive")} onSignOut={leaveAccount} onSave={saveMyProfile} onOpenBooking={openMyBooking} onInsights={() => go("insights")} />}
        {view === "checkout" && <CheckoutView booking={booking} state={bookingState} payment={currentPayment} method={method} holdTime={booking ? countdown(liveRemaining(booking, serverNow)) : ""} busy={busy} message={checkoutMessage} cardName={driverName} onBack={() => go(selected ? "spots" : "drive")} onMethod={chooseMethod} onPay={() => void finishPayment("succeeded")} onDecline={() => void finishPayment("failed")} onCancel={cancelMyBooking} onViewSpot={openMyBooking} onRoute={() => { if (booking) { setSelectedId(booking.lotCode); say("This is a simulated route preview, not driving directions."); go("nav"); } }} />}
        {view === "insights" && <InsightsView accountId={accountId} live={usesDatabase} lots={lots} location={location} radius={settings.radius} clockOffset={clockOffset} onBack={() => go("drive")} />}
        {["detail", "nav", "spots", "camera"].includes(view) && !selected && <section className="view active"><div className="settings"><p>Select a demo lot first.</p><button className="btn btn-primary" onClick={() => go("map")}>Open map</button></div></section>}
      </div>
      {toast && <div id="toast" className="show" role="status">{toast}</div>}
      {loading && <div id="loader" className="show"><div className="loader-card"><Image src="/assets/barrier.gif" width={150} height={132} alt="Opening barrier" unoptimized /><div className="lt">Finding a demo spot…</div><div className="ls">{usesDatabase ? "Reading the database" : "Simulated data"}</div><div className="loader-dots"><span /><span /><span /></div></div></div>}
    </>
  );
}
