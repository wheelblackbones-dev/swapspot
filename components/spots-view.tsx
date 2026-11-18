"use client";

import { DURATIONS, type SessionCard } from "@/lib/booking";
import type { DemoLot } from "@/lib/demo-lots";
import type { Spot, SpotState } from "@/lib/session";
import { Icon } from "./icon";

/** A spot as this driver sees it: `shown` is "mine" for their own spot, `picked` for the one they selected. */
export type ShownSpot = Spot & { shown: SpotState; picked: boolean };

type Props = {
  lot: DemoLot;
  /** null until the spots have been loaded. */
  spots: ShownSpot[] | null;
  /** True when the database is not connected and the built-in simulation is running. */
  demo: boolean;
  /** True while this driver's own spot is held and waiting for payment. */
  awaitingPayment: boolean;
  card: SessionCard;
  hours: number;
  busy: boolean;
  onBack: () => void;
  onSpot: (spotId: string) => void;
  onHours: (hours: number) => void;
  onPrimary: () => void;
  onCancel: () => void;
  onElsewhere: () => void;
};

const STATE_NAMES: Record<SpotState, string> = { free: "available", occ: "occupied", booked: "booked", mine: "your spot" };

export function SpotsView({ lot, spots, demo, awaitingPayment, card, hours, busy, onBack, onSpot, onHours, onPrimary, onCancel, onElsewhere }: Props) {
  const free = spots ? spots.filter((spot) => spot.shown === "free").length : 0;
  const subtitle = demo ? "demo" : spots ? `${free} free now` : "loading spots…";
  const fraction = Math.max(0, Math.min(1, card.dial.fraction));

  return (
    <section className="view active" id="view-spots">
      <div className="spots-view">
        <div className="spots-head"><button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button><div className="spots-title">Your Parking<span id="spotsLotName">{lot.name} · {subtitle}</span></div><div /></div>
        <div className="spot-legend"><span>🟢 Available</span><span>🔴 Occupied</span><span>🟡 Booked</span></div>
        <div className="spot-grid" id="spotGrid">
          {!spots && <div className="empty spot-grid-note">Loading spots…</div>}
          {spots?.map((spot) => (
            <button key={spot.id} className={`spot-cell ${spot.shown === "mine" ? "free mine sel" : spot.shown}${spot.picked ? " sel" : ""}`} onClick={() => onSpot(spot.id)} aria-label={`${spot.id}: ${spot.picked ? "selected" : STATE_NAMES[spot.shown]}`} aria-pressed={spot.shown === "free" ? spot.picked : undefined}>
              <span className="sp-id">{spot.id}</span>
              {spot.type === "ev" && <span className="sp-type">EV</span>}
              {spot.type === "accessible" && <span className="sp-type">ACCESSIBLE</span>}
              {spot.shown === "free" && <><span className="sp-status">{spot.picked ? "Selected" : "Available"}</span><span className="sp-sub">{spot.picked ? "Choose a duration below" : "Tap to select"}</span></>}
              {spot.shown === "mine" && <><span className="sp-status">{demo ? "Your demo spot" : "Your spot"}</span><span className="sp-sub">{demo ? "Tap to end" : awaitingPayment ? "Pay to confirm" : "Timer is below"}</span></>}
              {spot.shown === "occ" && <span>Occupied</span>}
              {spot.shown === "booked" && <span className="bk">Booked</span>}
            </button>
          ))}
        </div>
        <div className="session-card" id="sessionCard">
          <div className="session-row">
            <div className="lbl" id="sessionTitle">{card.title}</div>
            {card.button && <button id="parkToggle" className={`btn-park${card.buttonEnds ? " ended" : ""}${busy ? " busy" : ""}`} disabled={card.buttonDisabled} onClick={onPrimary}>{card.button}</button>}
          </div>
          {card.elsewhere && <div className="session-note" id="sessionNote">{card.elsewhere.text} <button onClick={onElsewhere}>Go there</button></div>}
          {card.showDurations && (
            <div className="day-tabs" id="durationTabs" role="group" aria-label="Parking duration">
              {DURATIONS.map((option) => <button key={option} className={`day-tab ${hours === option ? "on" : ""}`} data-hours={option} aria-pressed={hours === option} onClick={() => onHours(option)}>{option} h</button>)}
            </div>
          )}
          <div className="price-line" id="priceLine">{card.price}<small>{card.priceNote}</small></div>
          <div className="dial-wrap">
            <div className="dial">
              <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="86" fill="none" stroke="var(--surface3)" strokeWidth="14" strokeDasharray="3 7" /><circle id="dialArc" cx="100" cy="100" r="86" fill="none" stroke={`var(--${card.dial.tone})`} strokeWidth="14" strokeLinecap="round" strokeDasharray="540" strokeDashoffset={540 * (1 - fraction)} /></svg>
              <div className="dial-center"><div className="t" id="dialTime">{card.dial.time}</div><div className="s" id="dialState">{card.dial.label}</div></div>
            </div>
            {card.alert && <div className="dial-alert" id="dialAlert">{card.alert}</div>}
          </div>
          {card.showCancel && <div className="session-actions"><button className="link-btn" id="sessionCancel" onClick={onCancel}>Cancel booking</button></div>}
        </div>
      </div>
    </section>
  );
}
