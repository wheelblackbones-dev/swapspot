"use client";

import Image from "next/image";
import { useState } from "react";
import type { DemoLot } from "@/lib/demo-lots";
import { formatPrice, lotDistance, statusClass, statusLabel } from "@/lib/display";
import type { Coordinates } from "@/lib/parking";
import { Icon } from "./icon";

type Props = {
  nearest: DemoLot | null;
  location: Coordinates;
  answer: string;
  transcript: string;
  listening: boolean;
  speaking: boolean;
  /** The driver's booking in progress (a spot on hold or a paid session), shown under the nearest lot. */
  banner: { time: string; title: string; note: string; action: string } | null;
  onNearest: (id: string) => void;
  onMicrophone: () => void;
  onCommand: (command: string, source: "chip" | "text") => void;
  onBanner: () => void;
};

export function DriveView({ nearest, location, answer, transcript, listening, speaking, banner, onNearest, onMicrophone, onCommand, onBanner }: Props) {
  const [typedCommand, setTypedCommand] = useState("");
  return (
    <section className="view active" id="view-drive">
      <div className="drive">
        <div className="drive-top">
          <button className="nearest-card" onClick={() => nearest && onNearest(nearest.id)} disabled={!nearest}>
            <div className={`avail ${nearest ? statusClass(nearest) : ""}`}>{nearest?.avail ?? "—"}<small> free</small></div>
            <div className="meta"><div className="name">{nearest?.name ?? "No parking in range"}</div><div className="sub">{nearest ? `${lotDistance(nearest, location)} · ${formatPrice(nearest)} · ${statusLabel(nearest)}` : "Widen search radius in settings"}</div></div>
            <div className="go">View ›</div>
          </button>
          {banner && (
            <button className="live-banner" id="liveBanner" onClick={onBanner}>
              <div className="lb-time" id="lbTime">{banner.time}</div>
              <div className="lb-meta"><div className="lb-title" id="lbTitle">{banner.title}</div><div className="lb-sub" id="lbSub">{banner.note}</div></div>
              <div className="go" id="lbGo">{banner.action} ›</div>
            </button>
          )}
        </div>
        <div className="voice-stage">
          <div className={`mascot-wrap ${listening ? "listening" : speaking ? "speaking" : ""}`}><Image src="/assets/mascot.gif" alt="SwapSpot assistant mascot" width={104} height={72} unoptimized /></div>
          <div className={`ai-line ${speaking ? "speaking" : ""}`}>{answer}</div>
          <div className="transcript">{transcript}</div>
          <button className={`orb-wrap ${listening ? "listening" : speaking ? "speaking" : ""}`} onClick={onMicrophone} aria-label={listening ? "Stop listening" : "Start listening"}>
            <div className="orb-ring" /><div className="orb"><Icon name="mic" /></div>
          </button>
          <div className="orb-hint">{listening ? "Listening…" : "Tap to talk"}</div>
        </div>
        <div className="chips">
          {[["find parking", "Find parking", "nearest open spots"], ["cheapest parking", "Cheapest nearby", "best value today"], ["ev charging parking", "EV charging", "lots with chargers"]].map(([command, title, sub]) => (
            <button className="chip" key={command} data-cmd={command} onClick={() => onCommand(command, "chip")}>{title}<span className="sub">{sub}</span></button>
          ))}
        </div>
        <form className="text-command" onSubmit={(event) => {
          event.preventDefault();
          const command = typedCommand.trim();
          if (command) {
            onCommand(command, "text");
            setTypedCommand("");
          }
        }}>
          <label htmlFor="typed-command" className="sr-only">Type a parking request</label>
          <input id="typed-command" value={typedCommand} onChange={(event) => setTypedCommand(event.target.value)} placeholder="Type a parking request…" />
          <button type="submit">Send</button>
        </form>
      </div>
    </section>
  );
}
