"use client";

import { useState } from "react";
import { formatNumber, hourLabel, pad2 } from "@/lib/format";
import { peakOf, type HourlyPoint } from "@/lib/insights";

/** Shows the value of one mark while the pointer or the keyboard focus is on it. */
export type TipHandlers = {
  show: (element: HTMLElement, value: string, label: string) => void;
  hide: () => void;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function tipProps(tip: TipHandlers, value: string, label: string) {
  return {
    tabIndex: 0,
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => tip.show(event.currentTarget, value, label),
    onPointerLeave: tip.hide,
    onFocus: (event: React.FocusEvent<HTMLElement>) => tip.show(event.currentTarget, value, label),
    onBlur: tip.hide,
  };
}

type ChartProps = {
  points: HourlyPoint[];
  title: string;
  subtitle: string;
  /** The current hour in Bangkok, marked under the axis. */
  currentHour: number;
  tip: TipHandlers;
};

/**
 * Average occupancy for each hour of the day: one series, one colour.
 * Only the busiest hour is labelled; every value is available on hover or focus and in the table.
 */
export function HourChart({ points, title, subtitle, currentHour, tip }: ChartProps) {
  const [table, setTable] = useState(false);
  if (!points.length) {
    return <div className="empty">No sensor readings yet. The chart appears once the sensor feed has written some history.</div>;
  }
  const byHour = new Map(points.map((point) => [point.hour, point]));
  const peak = peakOf(points);
  const range = (hour: number) => `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`;
  return (
    <figure className="chart">
      <div className="chart-head">
        <div><div className="chart-title">{title}</div><div className="chart-sub">{subtitle}</div></div>
        <button className="link-btn" data-table-toggle onClick={() => setTable((value) => !value)}>{table ? "Hide table" : "Table"}</button>
      </div>
      <div className="cols" role="list" aria-label={title}>
        <span className="gridline" style={{ bottom: "50%" }} /><span className="gridline" style={{ bottom: "100%" }} />
        <span className="ylab" style={{ bottom: 0 }}>0%</span><span className="ylab" style={{ bottom: "50%" }}>50%</span><span className="ylab" style={{ bottom: "100%" }}>100%</span>
        <span className="ref-line" /><span className="ref-lab">85% = effectively full</span>
        {HOURS.map((hour) => {
          const point = byHour.get(hour);
          const percent = point ? Math.max(0, Math.min(100, point.occupancyPct)) : 0;
          const value = point ? `${Math.round(point.occupancyPct)}% full` : "no readings";
          const label = `${range(hour)}${point && point.availableSpots !== null ? ` · about ${formatNumber(point.availableSpots)} spaces free` : ""}`;
          return (
            <div className="col" role="listitem" key={hour} aria-label={`${range(hour)}: ${point ? `${Math.round(point.occupancyPct)} percent full` : "no readings"}`} {...tipProps(tip, value, label)}>
              <i style={{ height: `${percent}%` }} />
              {point && point === peak && <span className="cap" style={{ bottom: `calc(${percent}% + 4px)` }}>{Math.round(point.occupancyPct)}%</span>}
              {hour === currentHour && <span className="now" />}
            </div>
          );
        })}
      </div>
      <div className="xlabs" aria-hidden="true">{HOURS.map((hour) => <span key={hour}>{hour % 6 === 0 || hour === 23 ? pad2(hour) : ""}</span>)}</div>
      <div className="chart-note"><i />current hour · hours are Bangkok time</div>
      {table && (
        <div className="table-view">
          <table>
            <thead><tr><th>Hour</th><th>Average occupancy</th><th>Readings</th></tr></thead>
            <tbody>
              {HOURS.map((hour) => {
                const point = byHour.get(hour);
                return <tr key={hour}><td>{range(hour)}</td><td>{point ? `${point.occupancyPct.toFixed(1)}%` : "—"}</td><td>{point ? formatNumber(point.readings) : "0"}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export type Meter = { name: string; note?: string; percent: number; figure: string; tipValue?: string; tipLabel?: string };

/** Horizontal bars for ranking a handful of named things (lots, kinds of request). */
export function MeterList({ items, tip }: { items: Meter[]; tip: TipHandlers }) {
  return (
    <div className="meters">
      {items.map((item) => (
        <div className="meter-row" key={item.name} {...tipProps(tip, item.tipValue ?? item.figure, item.tipLabel ?? item.name)}>
          <div className="nm">{item.name}{item.note && <small>{item.note}</small>}</div>
          <div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }} /></div>
          <div className="fig">{item.figure}</div>
        </div>
      ))}
    </div>
  );
}
