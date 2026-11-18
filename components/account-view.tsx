"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Account, Profile } from "@/lib/backend";
import { METHOD_NAMES, STATUS_NAMES, shownStatus, type Booking } from "@/lib/booking";
import { baht, clockTime, dayAndTime } from "@/lib/format";
import { Icon } from "./icon";

type Props = {
  account: Account;
  profile: Profile | null;
  name: string;
  /** The booking that is on hold or in progress, with its countdown text. */
  live: { state: "pending" | "active"; booking: Booking; time: string } | null;
  /** Difference between the database clock and this device (milliseconds). */
  clockOffset: number;
  loadHistory: () => Promise<Booking[]>;
  onBack: () => void;
  onSignOut: () => void;
  onSave: (fields: Profile) => Promise<void>;
  onOpenBooking: () => void;
  onInsights: () => void;
};

type History =
  | { status: "loading" }
  | { status: "ready"; items: Booking[]; loadedAt: number }
  | { status: "error"; message: string };

function HistoryRow({ booking, now }: { booking: Booking; now: number }) {
  const status = shownStatus(booking, now);
  // A hold that ran out also cancels its open payment attempt.
  const paymentStatus = status === "expired" && booking.paymentStatus === "pending" ? "cancelled" : booking.paymentStatus;
  return (
    <div className="hist-row">
      <div className="hist-main">
        <div className="hist-title">{booking.lotName} · {booking.spotLabel}</div>
        <div className="hist-sub">
          {dayAndTime(booking.createdAt)} · {booking.durationHours} h{booking.hourlyRate === 0 ? " · free with a purchase" : ` at ${baht(booking.hourlyRate)}/hr`}
          {booking.paymentReference && booking.paymentMethod && (
            <> · {METHOD_NAMES[booking.paymentMethod]}{paymentStatus === "succeeded" ? "" : ` (${paymentStatus})`} <span className="mono">{booking.paymentReference}</span></>
          )}
        </div>
      </div>
      <div className="hist-amt">{booking.amount === 0 ? "Free" : baht(booking.amount)}<br /><span className={`status-chip st-${status}`}>{STATUS_NAMES[status]}</span></div>
    </div>
  );
}

function ProfileForm({ profile, saving, onSubmit }: { profile: Profile | null; saving: boolean; onSubmit: (fields: Profile) => void }) {
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [licensePlate, setLicensePlate] = useState(profile?.licensePlate ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ fullName, phone, licensePlate });
  }
  return (
    <form className="form" id="profileForm" noValidate onSubmit={submit}>
      <div className="field"><label htmlFor="pfName">Full name</label><input id="pfName" autoComplete="name" maxLength={80} value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
      <div className="field"><label htmlFor="pfPhone">Phone</label><input id="pfPhone" type="tel" autoComplete="tel" maxLength={20} placeholder="08x xxx xxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      <div className="field"><label htmlFor="pfPlate">License plate</label><input id="pfPlate" maxLength={20} placeholder="e.g. 1กข 1234" value={licensePlate} onChange={(event) => setLicensePlate(event.target.value)} /></div>
      <button className={`btn btn-ghost ${saving ? "busy" : ""}`} id="profileSave" type="submit">Save profile</button>
    </form>
  );
}

export function AccountView({ account, profile, name, live, clockOffset, loadHistory, onBack, onSignOut, onSave, onOpenBooking, onInsights }: Props) {
  const [history, setHistory] = useState<History>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "err" | "ok" } | null>(null);
  // Load the list again whenever the booking in progress changes (paid, ended, cancelled, ...).
  const liveKey = live ? `${live.booking.id}:${live.state}` : "none";

  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .then((items) => {
        if (!cancelled) setHistory({ status: "ready", items, loadedAt: Date.now() + clockOffset });
      })
      .catch((error: unknown) => {
        if (!cancelled) setHistory({ status: "error", message: error instanceof Error ? error.message : "Could not load your bookings." });
      });
    return () => {
      cancelled = true;
    };
  }, [loadHistory, liveKey, clockOffset]);

  async function save(fields: Profile) {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(fields);
      setMessage({ text: "Profile saved.", kind: "ok" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not save the profile.", kind: "err" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view active" id="view-account">
      <div className="page">
        <div className="page-head">
          <button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button>
          <button className="link-btn" id="signOutBtn" onClick={onSignOut}>Sign out</button>
        </div>
        <div className="acct-head">
          <div className="avatar" id="acctAvatar">{(name || "?").trim().charAt(0).toUpperCase()}</div>
          <div className="acct-who"><div className="page-title" id="acctName">{name}</div><div className="acct-email" id="acctEmail">{account.email}</div></div>
        </div>
        {live && (
          <div className="card" id="acctLive">
            <h3>{live.state === "pending" ? "Waiting for payment" : "Parking now"}</h3>
            <div className="hist-row">
              <div className="hist-main">
                <div className="hist-title">{live.booking.lotName} · {live.booking.spotLabel}</div>
                <div className="hist-sub">
                  {live.state === "pending"
                    ? <>Spot held for <b id="acctLiveTime">{live.time}</b> · {baht(live.booking.amount)} to pay</>
                    : <><b id="acctLiveTime">{live.time}</b> left{live.booking.endsAt ? ` · until ${clockTime(live.booking.endsAt)}` : ""}</>}
                </div>
              </div>
              <button className="btn-park" id="acctLiveGo" onClick={onOpenBooking}>{live.state === "pending" ? "Pay now" : "Open"}</button>
            </div>
          </div>
        )}
        <div className="card">
          <h3>Profile</h3>
          <ProfileForm key={profile ? `${profile.fullName}|${profile.phone}|${profile.licensePlate}` : "empty"} profile={profile} saving={saving} onSubmit={save} />
          {message && <div className={`msg ${message.kind}`} id="profileMsg" role="status">{message.text}</div>}
        </div>
        <div className="card">
          <h3>Bookings &amp; payments <span className="demo-flag">Demo · no real money</span></h3>
          <div id="historyList">
            {history.status === "loading" && <div className="empty">Loading…</div>}
            {history.status === "error" && <div className="empty">{history.message}</div>}
            {history.status === "ready" && !history.items.length && <div className="empty">No bookings yet. Pick a lot on the map, choose a spot and pay. It will show up here.</div>}
            {history.status === "ready" && history.items.map((booking) => <HistoryRow key={booking.id} booking={booking} now={history.loadedAt} />)}
          </div>
        </div>
        <button className="btn btn-ai btn-block" onClick={onInsights}><Icon name="chart" /> View insights (DIKW)</button>
      </div>
    </section>
  );
}
