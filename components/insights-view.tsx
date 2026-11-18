"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { backendReady, fetchLotHourly, fetchMyInsights, fetchPlatformInsights, fetchPublicInsights } from "@/lib/backend";
import { METHOD_NAMES, type PaymentMethod } from "@/lib/booking";
import type { DemoLot } from "@/lib/demo-lots";
import { formatPrice, lotDistance } from "@/lib/display";
import { baht, formatNumber, hourLabel, timeAgo } from "@/lib/format";
import {
  ACTION_TITLES, LEVEL_NAMES, bangkokHour, bestLotNow, cityKnowledge,
  type HourlyPoint, type MyInsights, type PlatformInsights, type PublicInsights,
} from "@/lib/insights";
import type { Coordinates } from "@/lib/parking";
import { HourChart, MeterList, type TipHandlers } from "./hour-chart";
import { Icon } from "./icon";

type Props = {
  /** Id of the signed-in driver, or null. Personal and platform totals need a signed-in driver. */
  accountId: string | null;
  /** True when the lots on screen come from the database (needed for the "right now" advice). */
  live: boolean;
  lots: DemoLot[];
  location: Coordinates;
  radius: number;
  /** Difference between the database clock and this device (milliseconds). */
  clockOffset: number;
  onBack: () => void;
};

type Loaded = { pub: PublicInsights; platform: PlatformInsights | null; mine: MyInsights | null; loadedAt: number };
type Tip = { value: string; label: string; x: number; y: number; below: boolean };

function Tile({ value, label }: { value: string; label: string }) {
  // Words get a smaller size than numbers so a lot name fits in the tile.
  return <div className={`tile ${/[a-z]{3}/i.test(value) ? "txt" : ""}`}><div className="v">{value}</div><div className="k">{label}</div></div>;
}

function AdviceItem({ tag, title, detail }: { tag: string; title: string; detail: string }) {
  return <div className="advice-item"><em>{tag}</em><b>{title}</b><span>{detail}</span></div>;
}

function DikwCard({ level, index, name, question, source, children }: { level: "d" | "i" | "k" | "w"; index: number; name: string; question: string; source: string; children: React.ReactNode }) {
  return (
    <section className={`dk-card lv-${level}`} id={`dk-${level}`}>
      <div className="dk-tag"><i />{index} · {name}</div>
      <div className="dk-q">{question}</div>
      {children}
      <div className="dk-src">source: {source}</div>
    </section>
  );
}

const percent = (value: number) => `${Math.round(value)}%`;
const words = (value: string) => value.replace(/_/g, " ");

export function InsightsView({ accountId, live, lots, location, radius, clockOffset, onBack }: Props) {
  const [tab, setTab] = useState<"driver" | "operator">("driver");
  const [lotCode, setLotCode] = useState("all");
  const [data, setData] = useState<Loaded | null>(null);
  const [hourly, setHourly] = useState<Record<string, HourlyPoint[]>>({});
  const [error, setError] = useState(backendReady ? "" : "Insights are read from the database, which is not connected.");
  const [refresh, setRefresh] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const tipShownAt = useRef(0);

  useEffect(() => {
    if (!backendReady) return;
    let cancelled = false;
    (async () => {
      try {
        const pub = await fetchPublicInsights();
        // Totals and personal figures are only for signed-in drivers; a failure there must not hide the public part.
        const [platform, mine] = accountId
          ? await Promise.all([fetchPlatformInsights().catch(() => null), fetchMyInsights().catch(() => null)])
          : [null, null];
        if (cancelled) return;
        setData({ pub, platform, mine, loadedAt: Date.now() });
        setError("");
      } catch (problem) {
        if (!cancelled) setError(problem instanceof Error ? problem.message : "Could not load the insights.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, refresh]);

  const loadedAt = data?.loadedAt ?? 0;
  const lot = data?.pub.patterns.some((pattern) => pattern.lotCode === lotCode) ? lotCode : "all";
  const hourlyKey = `${loadedAt}:${lot}`;
  const lotHourly = hourly[hourlyKey];

  useEffect(() => {
    if (!backendReady || lot === "all" || !loadedAt || lotHourly) return;
    let cancelled = false;
    fetchLotHourly(lot)
      .then((points) => {
        if (!cancelled) setHourly((current) => ({ ...current, [hourlyKey]: points }));
      })
      .catch((problem: unknown) => console.warn("SwapSpot insights:", problem));
    return () => {
      cancelled = true;
    };
  }, [lot, loadedAt, hourlyKey, lotHourly]);

  const tipHandlers = useMemo<TipHandlers>(() => ({
    show: (element, value, label) => {
      const box = element.getBoundingClientRect();
      const below = box.top < 70;
      tipShownAt.current = performance.now();
      setTip({
        value,
        label,
        below,
        x: Math.max(118, Math.min(window.innerWidth - 118, box.left + box.width / 2)),
        y: below ? box.bottom + 8 : box.top - 8,
      });
    },
    hide: () => setTip(null),
  }), []);

  // A scroll right after the tooltip appears is the browser bringing the focused mark into view: keep it.
  const hideTipOnScroll = useCallback(() => {
    if (performance.now() - tipShownAt.current > 250) setTip(null);
  }, []);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const body = (() => {
    if (!data) return <div className="empty">{error || "Loading insights…"}</div>;
    const { pub, platform, mine } = data;
    const driver = tab === "driver";
    const summary = pub.summary;
    const pattern = lot === "all" ? null : pub.patterns.find((item) => item.lotCode === lot) ?? null;
    const action = lot === "all" ? null : pub.actions.find((item) => item.lotCode === lot) ?? null;
    const lotName = pattern?.lotName ?? "All lots";
    const points = lot === "all" ? pub.cityHourly : lotHourly ?? [];
    const serverNow = loadedAt + clockOffset;
    const city = cityKnowledge(pub);
    const best = live ? bestLotNow(lots, location, radius, new Date(loadedAt)) : null;
    const bestPattern = best ? pub.patterns.find((item) => item.lotCode === best.id) : undefined;
    const lotActions = action ? [action] : pub.actions.filter((item) => item.operatorAction !== "keep_price");
    const maxRevenue = platform ? Math.max(1, ...platform.information.byLot.map((item) => item.revenue)) : 1;
    const totalSearches = platform ? Math.max(1, platform.information.byIntent.reduce((sum, item) => sum + item.searches, 0)) : 1;
    const personal = driver ? "function get_my_insights()" : "function get_platform_insights()";

    return <>
      <DikwCard level="d" index={1} name="Data" question="Raw records" source={driver
        ? "tables availability_snapshots, parking_lots, parking_spots · my rows in bookings, payments, search_events"
        : "tables availability_snapshots, parking_lots, parking_spots, bookings, payments, search_events"}>
        <div className="dk-lead">Every number further up is calculated from these rows. Last sensor reading: {timeAgo(summary?.lastReadingAt ?? null, serverNow)}. The sensor feed is simulated.</div>
        <div className="tiles">
          <Tile value={formatNumber(summary?.sensorReadings ?? 0)} label="sensor readings" />
          <Tile value={formatNumber(summary?.lots ?? 0)} label="parking lots" />
          <Tile value={formatNumber(summary?.bays ?? 0)} label="bookable spots" />
          {!driver && <Tile value={formatNumber(summary?.operators ?? 0)} label="operators" />}
          {driver && mine && <>
            <Tile value={formatNumber(mine.data.bookings)} label="my bookings" />
            <Tile value={formatNumber(mine.data.payments)} label="my payment attempts" />
            <Tile value={formatNumber(mine.data.searchEvents)} label="my requests" />
          </>}
          {!driver && platform && <>
            <Tile value={formatNumber(platform.data.users)} label="drivers" />
            <Tile value={formatNumber(platform.data.bookings)} label="bookings" />
            <Tile value={formatNumber(platform.data.payments)} label="payment attempts" />
            <Tile value={formatNumber(platform.data.searchEvents)} label="requests logged" />
          </>}
        </div>
        {driver && !accountId && <div className="dk-lead">Sign in to add your own bookings, payments and requests to this view.</div>}
        {!driver && !platform && <div className="dk-lead">Sign in to see booking, payment and request totals.</div>}
      </DikwCard>

      <DikwCard level="i" index={2} name="Information" question="What happened?" source={`${lot === "all" ? "view dikw_information_city_hourly" : "view dikw_information_lot_hourly"} · ${personal}`}>
        <HourChart points={points} title={`Average occupancy by hour — ${lotName}`} subtitle="Last 14 days of sensor readings" currentHour={bangkokHour(serverNow)} tip={tipHandlers} />
        {driver && mine && (
          <div className="tiles">
            <Tile value={baht(mine.information.totalSpent)} label="spent on parking (demo payments)" />
            <Tile value={`${formatNumber(mine.information.hoursBooked)} h`} label="hours booked" />
            <Tile value={formatNumber(mine.information.bookingsPaid)} label="paid bookings" />
            <Tile value={mine.information.favouriteLot ?? "—"} label="lot I use most" />
          </div>
        )}
        {!driver && platform && <>
          <div className="tiles">
            <Tile value={baht(platform.information.revenue)} label="revenue (demo payments)" />
            <Tile value={formatNumber(platform.information.bookingsPaid)} label="paid bookings" />
            <Tile value={platform.information.averageTicket === null ? "—" : baht(platform.information.averageTicket)} label="average payment" />
            <Tile value={platform.information.averageHours === null ? "—" : `${platform.information.averageHours} h`} label="average stay" />
            <Tile value={platform.information.paymentSuccessRate === null ? "—" : percent(platform.information.paymentSuccessRate * 100)} label="payments that succeed" />
          </div>
          {platform.information.byLot.length > 0 && (
            <div className="chart"><div className="chart-title">Revenue by lot</div>
              <MeterList tip={tipHandlers} items={platform.information.byLot.map((item) => ({
                name: item.lotName, note: `${item.bookings} ${item.bookings === 1 ? "booking" : "bookings"}`, percent: 100 * item.revenue / maxRevenue, figure: baht(item.revenue),
              }))} />
            </div>
          )}
          {platform.information.byIntent.length > 0 && (
            <div className="chart"><div className="chart-title">What drivers ask for</div>
              <MeterList tip={tipHandlers} items={platform.information.byIntent.map((item) => ({
                name: words(item.intent), percent: 100 * item.searches / totalSearches, figure: percent(100 * item.searches / totalSearches),
                tipValue: `${item.searches} ${item.searches === 1 ? "request" : "requests"}`,
              }))} />
            </div>
          )}
        </>}
      </DikwCard>

      <DikwCard level="k" index={3} name="Knowledge" question="What is the pattern?" source={`view dikw_knowledge_lot_patterns · ${personal}`}>
        {pattern && <>
          <div className="dk-lead">{pattern.lotName} <span className="level-chip">{LEVEL_NAMES[pattern.demandLevel]}</span></div>
          <div className="kv">
            <Tile value={`${hourLabel(pattern.peakHour)} · ${percent(pattern.peakPct)}`} label="busiest hour" />
            <Tile value={`${hourLabel(pattern.quietHour)} · ${percent(pattern.quietPct)}`} label="quietest daytime hour" />
            <Tile value={percent(pattern.weekdayPct)} label="average on weekdays" />
            <Tile value={percent(pattern.weekendPct)} label="average at weekends" />
          </div>
        </>}
        {!pattern && pub.patterns.length > 0 && (
          <div className="kv">
            {city.busiest && <Tile value={`${hourLabel(city.busiest.hour)} · ${percent(city.busiest.occupancyPct)}`} label="busiest hour city-wide" />}
            {city.calmest && <Tile value={`${hourLabel(city.calmest.hour)} · ${percent(city.calmest.occupancyPct)}`} label="quietest daytime hour" />}
            <Tile value={`${percent(city.weekendPct)} vs ${percent(city.weekdayPct)}`} label="weekend vs weekday" />
            <Tile value={`${city.levels.high} / ${city.levels.balanced} / ${city.levels.low}`} label="lots with high / balanced / low demand" />
          </div>
        )}
        {!pattern && !pub.patterns.length && <div className="empty">Patterns appear once there is sensor history.</div>}
        {driver && mine && mine.information.bookingsPaid > 0 && (
          <div className="kv">
            <Tile value={mine.knowledge.usualHour === null ? "—" : hourLabel(mine.knowledge.usualHour)} label="when I usually book" />
            <Tile value={mine.knowledge.usualDayType ?? "—"} label="my usual day" />
            <Tile value={mine.knowledge.topIntent ? words(mine.knowledge.topIntent) : "—"} label="what I ask for most" />
            <Tile value={mine.information.favouriteLotVisits === null ? "—" : `${formatNumber(mine.information.favouriteLotVisits)}×`} label="visits to my usual lot" />
          </div>
        )}
        {!driver && !pattern && pub.patterns.length > 0 && (
          <div className="chart"><div className="chart-title">Peak occupancy by lot</div><div className="chart-sub">How full each lot gets in its busiest hour</div>
            <MeterList tip={tipHandlers} items={pub.patterns.map((item) => ({
              name: item.lotName, note: `${LEVEL_NAMES[item.demandLevel]} · peaks at ${hourLabel(item.peakHour)}`, percent: item.peakPct, figure: percent(item.peakPct),
              tipLabel: `${item.lotName} · ${baht(item.hourlyRate)}/hr`,
            }))} />
          </div>
        )}
        {!driver && platform && (
          <div className="kv">
            <Tile value={platform.knowledge.conversionRate === null ? "—" : percent(platform.knowledge.conversionRate * 100)} label="holds that get paid" />
            <Tile value={platform.knowledge.busiestBookingHour === null ? "—" : hourLabel(platform.knowledge.busiestBookingHour)} label="busiest booking hour" />
            <Tile value={platform.knowledge.topLot ?? "—"} label="most booked lot" />
            <Tile value={platform.knowledge.preferredMethod ? METHOD_NAMES[platform.knowledge.preferredMethod as PaymentMethod] ?? platform.knowledge.preferredMethod : "—"} label="preferred payment" />
          </div>
        )}
      </DikwCard>

      <DikwCard level="w" index={4} name="Wisdom" question={driver ? "What should I do?" : "What should we do?"} source={driver
        ? "view dikw_wisdom_lot_actions · view lot_overview (current) · function get_my_insights()"
        : "view dikw_wisdom_lot_actions · function get_platform_insights()"}>
        <div className="advice">
          {driver && best && <AdviceItem tag="Right now" title={`Park at ${best.name}`} detail={`${formatNumber(best.avail)} of ${formatNumber(best.total)} spaces are free (${percent(100 * (1 - best.avail / best.total))} full), ${formatPrice(best)}, ${lotDistance(best, location)} away.${bestPattern ? ` It is usually busiest around ${hourLabel(bestPattern.peakHour)}.` : ""}`} />}
          {driver && live && !best && <AdviceItem tag="Right now" title="Nothing open nearby" detail={`No open lot with free space inside your ${radius} km search radius. Widen the radius in Settings.`} />}
          {driver && action && <AdviceItem tag={action.lotName} title="When to go" detail={action.driverTip} />}
          {driver && mine?.wisdom.map((item) => <AdviceItem key={item.title} tag="For you" title={item.title} detail={item.detail} />)}
          {driver && !accountId && <AdviceItem tag="For you" title="Sign in for personal tips" detail="Once you have a booking or two, this section compares your habits with each lot's pattern." />}
          {!driver && platform?.wisdom.map((item) => <AdviceItem key={item.title} tag="Platform" title={item.title} detail={item.detail} />)}
          {!driver && lotActions.map((item) => <AdviceItem key={item.lotCode} tag={item.lotName} title={ACTION_TITLES[item.operatorAction]} detail={item.operatorTip} />)}
          {!driver && !platform && <AdviceItem tag="Platform" title="Sign in for revenue advice" detail="Booking and payment totals are only shown to signed-in users." />}
        </div>
      </DikwCard>
    </>;
  })();

  const lotOptions = data ? [...data.pub.patterns].sort((a, b) => a.lotName.localeCompare(b.lotName)) : [];

  return (
    <section className="view active" id="view-insights">
      <div className="page" onScroll={hideTipOnScroll}>
        <div className="page-head">
          <button className="back-btn" onClick={onBack}><Icon name="back" /> Back</button>
          <button className="link-btn" id="insRefresh" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
        </div>
        <div className="page-title">Insights<small>The DIKW pyramid, built from the SwapSpot database: raw Data becomes Information, then Knowledge, then Wisdom.</small></div>
        <div className="day-tabs" id="insTabs" role="tablist">
          <button className={`day-tab ${tab === "driver" ? "on" : ""}`} data-tab="driver" role="tab" aria-selected={tab === "driver"} onClick={() => setTab("driver")}>For drivers</button>
          <button className={`day-tab ${tab === "operator" ? "on" : ""}`} data-tab="operator" role="tab" aria-selected={tab === "operator"} onClick={() => setTab("operator")}>For operators</button>
        </div>
        <div className="pyr" id="pyramid" aria-label="DIKW pyramid">
          <button className="lv-w" onClick={() => jump("dk-w")}>Wisdom <small>what to do</small></button>
          <button className="lv-k" onClick={() => jump("dk-k")}>Knowledge <small>the pattern</small></button>
          <button className="lv-i" onClick={() => jump("dk-i")}>Information <small>what happened</small></button>
          <button className="lv-d" onClick={() => jump("dk-d")}>Data <small>raw records</small></button>
        </div>
        <div className="ins-filter">
          <label htmlFor="insLot">Lot</label>
          <select className="set-sel" id="insLot" value={lot} onChange={(event) => setLotCode(event.target.value)}>
            <option value="all">All lots (city-wide)</option>
            {lotOptions.map((pattern) => <option key={pattern.lotCode} value={pattern.lotCode}>{pattern.lotName}</option>)}
          </select>
        </div>
        {data && error && <div className="msg err" role="status">{error}</div>}
        <div id="insBody" className="dikw">{body}</div>
      </div>
      {tip && (
        <div className={`tip ${tip.below ? "below" : ""}`} id="chartTip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.value}</b>{tip.label}
        </div>
      )}
    </section>
  );
}
