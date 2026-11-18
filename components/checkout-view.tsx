"use client";

import { useEffect, useMemo, useRef } from "react";
import qrcode from "qrcode-generator";
import { METHOD_NAMES, type Booking, type LiveState, type Payment, type PaymentMethod } from "@/lib/booking";
import { baht, clockTime, dayAndTime } from "@/lib/format";
import { Icon } from "./icon";

type Props = {
  /** This driver's booking, and whether it is waiting for payment ("pending") or paid ("active"). */
  booking: Booking | null;
  state: LiveState;
  /** The open payment attempt for the selected method (null while it is being prepared). */
  payment: Payment | null;
  method: PaymentMethod;
  /** Time left on the 10 minute hold, e.g. 09:41. */
  holdTime: string;
  busy: boolean;
  message: string;
  cardName: string;
  onBack: () => void;
  onMethod: (method: PaymentMethod) => void;
  onPay: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onViewSpot: () => void;
  onRoute: () => void;
};

/** A QR code drawn as one SVG path. It only encodes the text below it: it is not a real PromptPay code. */
function DemoQr({ text }: { text: string }) {
  const code = useMemo(() => {
    try {
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      const size = qr.getModuleCount();
      let path = "";
      for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
          if (qr.isDark(row, column)) path += `M${column},${row}h1v1h-1z`;
        }
      }
      return { size, path };
    } catch (error) {
      console.warn("Could not draw the demo QR code", error);
      return null;
    }
  }, [text]);
  if (!code) return null;
  return (
    <div className="qr-box">
      <svg viewBox={`-2 -2 ${code.size + 4} ${code.size + 4}`} role="img" aria-label="Demo QR code" shapeRendering="crispEdges">
        <path d={code.path} fill="#000" />
      </svg>
    </div>
  );
}

function Row({ label, children, total = false }: { label: string; children: React.ReactNode; total?: boolean }) {
  return <div className={`sum-row ${total ? "sum-total" : ""}`}><span>{label}</span><b>{children}</b></div>;
}

export function CheckoutView({ booking, state, payment, method, holdTime, busy, message, cardName, onBack, onMethod, onPay, onDecline, onCancel, onViewSpot, onRoute }: Props) {
  const messageBox = useRef<HTMLDivElement>(null);

  // The Pay button stays at the bottom of the screen and can cover a new message: bring the message into view.
  useEffect(() => {
    if (message) messageBox.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [message]);

  if (booking && state === "active") {
    return (
      <section className="view active" id="view-checkout">
        <div className="page">
          <div className="page-head"><button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button></div>
          <div id="checkoutReceipt" className="form">
            <div>
              <div className="receipt-check"><Icon name="check" /></div>
              <div className="receipt-title">{booking.amount === 0 ? "Spot booked" : "Payment received"}</div>
              <div className="receipt-sub">Spot {booking.spotLabel} at {booking.lotName} is yours{booking.endsAt ? ` until ${clockTime(booking.endsAt)}` : ""}.</div>
            </div>
            <div className="card">
              <h3>Receipt <span className="demo-flag">Demo · no real money</span></h3>
              <Row label="Reference"><span className="mono">{booking.paymentReference ?? "—"}</span></Row>
              <Row label="Paid with">{booking.paymentMethod ? METHOD_NAMES[booking.paymentMethod] : "—"}</Row>
              <Row label="Paid at">{booking.paidAt ? dayAndTime(booking.paidAt) : "—"}</Row>
              <Row label="Parking">{booking.durationHours} h{booking.startsAt && booking.endsAt ? ` · ${clockTime(booking.startsAt)}–${clockTime(booking.endsAt)}` : ""}</Row>
              <Row label="Total paid" total>{baht(booking.amount)}</Row>
            </div>
            <div className="cta-row cta-static">
              <button className="btn btn-ghost" id="rcSpot" onClick={onViewSpot}>View my spot</button>
              <button className="btn btn-primary" id="rcNav" onClick={onRoute}><Icon name="navigate" /> Demo route</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!booking || state !== "pending") {
    return (
      <section className="view active" id="view-checkout">
        <div className="page">
          <div className="page-head"><button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button></div>
          <div className="page-title">Checkout<small>There is nothing to pay right now. Choose a spot first, then come back here.</small></div>
        </div>
      </section>
    );
  }

  const capped = booking.amount < booking.hourlyRate * booking.durationHours;
  return (
    <section className="view active" id="view-checkout">
      <div className="page">
        <div className="page-head">
          <button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button>
          <span className="hold-chip" id="holdChip">Held {holdTime}</span>
        </div>
        <div id="checkoutPay" className="form">
          <div className="page-title">Checkout<small id="coSub">{booking.lotName} · spot {booking.spotLabel}</small></div>
          <div className="card" id="coSummary">
            <h3>Order summary</h3>
            <Row label="Lot">{booking.lotName}</Row>
            <Row label="Spot">{booking.spotLabel}{booking.spotType === "standard" ? "" : ` · ${booking.spotType}`}</Row>
            <Row label="Duration">{booking.durationHours} h</Row>
            <Row label="Rate">{baht(booking.hourlyRate)} / hour</Row>
            {capped && <Row label="Daily maximum">applied</Row>}
            <Row label="Total" total>{baht(booking.amount)}</Row>
          </div>
          <div className="card">
            <h3>Payment method <span className="demo-flag">Demo · no real money</span></h3>
            <div className="day-tabs" id="methodTabs" role="tablist">
              {(["promptpay_qr", "card"] as const).map((item) => (
                <button key={item} className={`day-tab ${method === item ? "on" : ""}`} data-method={item} role="tab" aria-selected={method === item} onClick={() => onMethod(item)}>{METHOD_NAMES[item]}</button>
              ))}
            </div>
            <div className="pay-panel" id="payPanel">
              {!payment && <div className="pay-note">Preparing payment…</div>}
              {payment && method === "promptpay_qr" && <>
                <DemoQr text={`SWAPSPOT DEMO PAYMENT | ref ${payment.reference} | THB ${payment.amount.toFixed(2)} | not a real PromptPay code`} />
                <div className="pay-ref">Ref {payment.reference} · {baht(payment.amount)}</div>
                <div className="pay-note">Demo QR for {booking.lotName}. It is not a real PromptPay code: scanning it shows the reference only, and no money moves. Tap Pay to simulate the transfer.</div>
              </>}
              {payment && method === "card" && <>
                <div className="demo-card"><div className="brandline"><span>SWAPSPOT TEST CARD</span><span>DEMO</span></div><div className="num">4242 4242 4242 4242</div><div className="who"><span>{(cardName || "DRIVER").toUpperCase().slice(0, 22)}</span><span>12/30</span></div></div>
                <div className="pay-ref">Ref {payment.reference} · {baht(payment.amount)}</div>
                <div className="pay-note">A built-in test card. Do not enter a real card anywhere in this demo: nothing is charged. Tap Pay to simulate the charge.</div>
              </>}
            </div>
          </div>
          {message && <div className="msg err" id="coMsg" role="status" ref={messageBox}>{message}</div>}
          <div className="link-row">
            <button className="link-btn" id="declineBtn" onClick={onDecline} disabled={!payment || busy}>Simulate a declined payment</button>
            <button className="link-btn" id="cancelBookingBtn" onClick={onCancel} disabled={busy}>Cancel booking</button>
          </div>
          <div className="cta-row"><button className={`btn btn-primary ${busy ? "busy" : ""}`} id="payBtn" onClick={onPay} disabled={!payment}>Pay {baht(booking.amount)} (demo)</button></div>
        </div>
      </div>
    </section>
  );
}
