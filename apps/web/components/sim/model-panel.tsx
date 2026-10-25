"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BASELINE_AC_C, ENERGY, SETBACK_C, type ModelResult } from "../../lib/model-sim";
import type { EnergyTotals } from "../../lib/billing";
import { fmtDeltaF, fmtF, signedF, toF } from "../../lib/units";

export type HourLog = {
  at: string;
  label: string;
  people: number;
  hot: number;
  cold: number;
  setpointC: number;
  roomC: number;
  wantC: number | null;
  group: string;
  className: string;
  fixedKwh: number;
  modelKwh: number;
};

export type KnownGroup = {
  gid: number;
  weekday: number;
  startHour: number;
  size: number;
  weeks: number[];
  offsetC: number;
};

type Tab = "decision" | "learning" | "energy" | "bills";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const signed = (v: number) => (Math.abs(v) < 0.05 ? "±0.0" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`);
const money = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gname = (gid: number) => `G${String(gid).padStart(2, "0")}`;

export function ModelPanel({
  clock,
  result,
  history,
  totals,
  groups,
  hot,
  cold,
  wantC,
  className,
  onNextHour,
  onNextWeek,
  onReset,
}: {
  clock: string;
  result: ModelResult;
  history: HourLog[];
  totals: EnergyTotals;
  groups: KnownGroup[];
  hot: number;
  cold: number;
  wantC: number | null;
  className: string;
  onNextHour: () => void;
  onNextWeek: () => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>("decision");
  const m = result.model;
  const current = m.group;
  const known = current ? groups.find((g) => g.gid === current.gid) : undefined;
  // A group the model already knew, walking in on a new week.
  const recognized = Boolean(current && known && !m.continuing && current.weeks.length > known.weeks.length);

  return (
    <div className="result-card model-card">
      <div className="model-head">
        <div className="model-clock">
          <strong>{clock}</strong>
          <span className={`model-pill${recognized ? " known" : ""}`}>
            {result.closed ? "empty" : current ? (recognized ? `${gname(current.gid)} recognized` : gname(current.gid)) : "drop-in"}
          </span>
          <span className="model-sub">
            {className} · learned {totals.hours} h
          </span>
        </div>
        <div className="model-actions">
          <button type="button" className="ghost" onClick={onNextHour}>
            Next hour
          </button>
          <button type="button" className="ghost" onClick={onNextWeek}>
            Next week
          </button>
          <button type="button" className="ghost" onClick={onReset} aria-label="Reset learning">
            Reset
          </button>
        </div>
      </div>
      <div className="model-tabs" role="tablist" aria-label="Model views">
        {(["decision", "learning", "energy", "bills"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="model-tab" onClick={() => setTab(t)}>
            {t === "decision" ? "Decision" : t === "learning" ? "Learning" : t === "energy" ? "Energy" : "Bills"}
          </button>
        ))}
      </div>
      <div className="model-body" role="tabpanel">
        {tab === "decision" && result.closed ? (
          <p className="model-hint">The room is closed: votes are ignored and the AC sets back to {fmtF(SETBACK_C)}. Open it to see the model decide.</p>
        ) : null}
        {tab === "decision" && !result.closed ? (
          <div className="model-split">
            <Waterfall result={result} />
            <div className="model-side">
              <VoteTug hot={hot} cold={cold} correctionC={m.correctionC} />
              <dl className="model-temps">
                <div>
                  <dt>AC set</dt>
                  <dd>{fmtF(result.targetC)}</dd>
                </div>
                <div>
                  <dt>Room ≈</dt>
                  <dd>{fmtF(result.roomAfterC)}</dd>
                </div>
                <div>
                  <dt>Group wants</dt>
                  <dd>{wantC === null ? "—" : fmtF(wantC)}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}
        {tab === "learning" ? (
          <div className="model-split">
            <LearningChart history={history} />
            <GroupCards groups={groups} currentGid={current?.gid ?? null} />
          </div>
        ) : null}
        {tab === "energy" ? <EnergyView history={history} totals={totals} result={result} /> : null}
        {tab === "bills" ? <BillsView totals={totals} /> : null}
      </div>
    </div>
  );
}

/** How the setpoint is built: the people curve, the group's taste, then 0.5 C steps and vote rules. */
function Waterfall({ result }: { result: ModelResult }) {
  const m = result.model;
  const afterGroup = m.curveC + m.offsetC;
  const steps = [
    { label: "People", from: null as number | null, to: m.curveC, note: fmtF(m.curveC) },
    { label: "Group taste", from: m.curveC, to: afterGroup, note: signedF(m.offsetC) },
    { label: "Steps, vote rules", from: afterGroup, to: result.targetC, note: signedF(result.targetC - afterGroup) },
    { label: "AC setpoint", from: null, to: result.targetC, note: fmtF(result.targetC) },
  ];
  const values = [m.curveC, afterGroup, result.targetC, m.startC];
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="waterfall" aria-label="How the setpoint is built">
      {steps.map((s, i) => {
        const a = s.from ?? lo;
        const left = x(Math.min(a, s.to));
        const width = Math.max(0.8, Math.abs(x(s.to) - x(a)));
        const kind = s.from === null ? (i === 0 ? "base" : "total") : s.to < s.from ? "down" : s.to > s.from ? "up" : "flat";
        return (
          <div className="wf-row" key={s.label}>
            <span className="wf-label">{s.label}</span>
            <span className="wf-track">
              <span className={`wf-bar ${kind}`} style={{ left: `${left}%`, width: `${width}%` }} />
              {i === 3 ? <span className="wf-start" style={{ left: `${x(m.startC)}%` }} /> : null}
            </span>
            <span className="wf-note">{s.note}</span>
          </div>
        );
      })}
      <div className="wf-axis">
        <span>{fmtF(lo, 0)}</span>
        <span className="wf-legend">
          <i /> start {fmtF(m.startC)}
        </span>
        <span>{fmtF(hi, 0)}</span>
      </div>
    </div>
  );
}

/** Majority rule: the needle sits at the vote margin; balanced means the AC holds. */
function VoteTug({ hot, cold, correctionC }: { hot: number; cold: number; correctionC: number }) {
  const voters = hot + cold;
  const margin = voters === 0 ? 0 : (hot - cold) / voters; // +1 all hot, -1 all cold
  const coldPct = voters === 0 ? 50 : (cold / voters) * 100;
  const verdict =
    voters === 0
      ? "No votes: the AC holds"
      : hot === cold
        ? "Balanced: the AC holds"
        : hot > cold
          ? `Hot majority: cooler, ${signedF(correctionC)} asked`
          : `Cold majority: warmer, ${signedF(correctionC)} asked`;
  return (
    <div className="tug" aria-label={`${cold} cold and ${hot} hot votes. ${verdict}`}>
      <div className="tug-bar">
        <span className="tug-cold" style={{ width: `${coldPct}%` }} />
        <span className="tug-hot" style={{ width: `${100 - coldPct}%` }} />
        <span className="tug-center" />
        <span className="tug-needle" style={{ left: `${50 + margin * 50}%` }} />
      </div>
      <div className="tug-labels">
        <span>{cold} cold</span>
        <span>{hot} hot</span>
      </div>
      <p className="tug-verdict">{verdict}</p>
    </div>
  );
}

const tooltipStyle = { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 4, color: "var(--ink)", fontSize: 12 };
const axisTick = { fill: "var(--muted)", fontSize: 11 };

function LearningChart({ history }: { history: HourLog[] }) {
  if (!history.length) {
    return (
      <p className="model-hint">
        Press Next hour. The model learns from each hour’s votes and the room reacts. Next week brings the same class back.
      </p>
    );
  }
  const data = history.map((h, i) => ({ i: i + 1, label: h.label, setpoint: Number(toF(h.setpointC).toFixed(1)), room: Number(toF(h.roomC).toFixed(1)), want: h.wantC === null ? null : Number(toF(h.wantC).toFixed(1)) }));
  const weekStarts = history
    .map((h, i) => ({ i: i + 1, week: h.label.split(" · ")[0] ?? "" }))
    .filter((p, k, all) => k > 0 && p.week !== all[k - 1]?.week);
  return (
    <div className="model-chart" aria-label="AC setpoint, room temperature and the group's preference by hour">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="i" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")} />
          {weekStarts.map((w) => (
            <ReferenceLine
              key={w.i}
              x={w.i}
              stroke="var(--muted)"
              strokeDasharray="2 2"
              label={{ value: w.week, position: "insideTopLeft", fill: "var(--muted)", fontSize: 10 }}
            />
          ))}
          <Line type="stepAfter" dataKey="setpoint" name="AC setpoint" stroke="var(--cold)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="room" name="Room" stroke="var(--ink)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="want" name="Group wants" stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** What the model remembers: each recurring group and how it differs from the people curve. */
function GroupCards({ groups, currentGid }: { groups: KnownGroup[]; currentGid: number | null }) {
  if (!groups.length) {
    return <p className="model-hint">No groups yet. 15 or more people who start at the same hour become a group the model remembers.</p>;
  }
  return (
    <ul className="group-cards">
      {groups.map((g) => (
        <li key={g.gid} className={g.gid === currentGid ? "now" : undefined}>
          <strong>{gname(g.gid)}</strong>
          <span>
            {DAYS[g.weekday]} {String(g.startHour).padStart(2, "0")}:00 · ~{Math.round(g.size)} people
          </span>
          <span>
            {g.offsetC === 0 ? "no taste learned yet" : `${signedF(g.offsetC)} vs the curve`} · {g.weeks.length} week
            {g.weeks.length === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Energy so far: every simulated hour at a fixed 24 C versus the model's setpoints. */
function EnergyView({ history, totals, result }: { history: HourLog[]; totals: EnergyTotals; result: ModelResult }) {
  // Before the first hour, show what this hour would save.
  const counting = totals.hours > 0;
  const fixed = counting ? totals.fixedKwh : result.baselineKwh;
  const model = counting ? totals.modelKwh : result.adaptiveKwh;
  const saved = fixed - model;
  const dollars = totals.bills.reduce((sum, b) => sum + b.fixedCost - b.modelCost, 0);
  const pct = fixed > 0 ? (saved / fixed) * 100 : 0;
  const save = saved >= 0;
  const delta = result.targetC - BASELINE_AC_C;
  const hourPct = (1 - (1 - ENERGY.savingPerC) ** delta) * 100;
  // One bar per day: a week of hourly bars is too thin to see.
  const days = new Map<string, { label: string; fixed: number; model: number }>();
  for (const h of history) {
    const label = h.label.slice(0, -6); // "Week 2 · Mon 09:00" -> "Week 2 · Mon"
    const day = days.get(label) ?? { label, fixed: 0, model: 0 };
    day.fixed += h.fixedKwh;
    day.model += h.modelKwh;
    days.set(label, day);
  }
  const data = [...days.values()].map((d, i) => ({ i: i + 1, day: d.label.slice(-3), label: d.label, fixed: Number(d.fixed.toFixed(1)), model: Number(d.model.toFixed(1)) }));
  return (
    <div className="model-split">
      <div className="energy-totals">
        <div className="energy-hero">
          <span>{counting ? `${save ? "Saved" : "Extra"} vs AC fixed at ${fmtF(BASELINE_AC_C)} · ${totals.hours} h` : `This hour vs AC fixed at ${fmtF(BASELINE_AC_C)} · press Next hour to count`}</span>
          <strong className={save ? "save" : "spend"}>
            {Math.abs(saved).toFixed(1)} kWh <small>{save ? "−" : "+"}{Math.abs(pct).toFixed(0)}%</small>
          </strong>
          <span>
            {counting ? `${money(Math.abs(dollars))} on ${totals.bills.length} LADWP bill${totals.bills.length === 1 ? "" : "s"} · ` : ""}
            {Math.abs(saved * ENERGY.kgCo2PerKwh).toFixed(1)} kg CO₂e · fixed {fixed.toFixed(1)} → model {model.toFixed(1)} kWh
          </span>
        </div>
        <p className="model-hint">
          This hour: AC {fmtF(result.targetC)} is {fmtDeltaF(delta)} {delta >= 0 ? "warmer" : "cooler"} than {fmtF(BASELINE_AC_C)}, so cooling uses{" "}
          {Math.abs(hourPct).toFixed(0)}% {hourPct >= 0 ? "less" : "more"}. More people means more heat to remove, so each degree is worth more kWh.
        </p>
        <p className="energy-source">
          About 10% less cooling per 1.8°F warmer (Hoyt et al. 2015: 72→77°F saved 29%). 117 W per seated person (ASHRAE). COP 3, 0.4 kg CO₂e/kWh. Bills: LADWP R-1A 2026, every two months (Bills tab).
        </p>
      </div>
      {data.length ? (
        <div className="model-chart" aria-label={`Energy per day, AC fixed at ${BASELINE_AC_C} C versus the model`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }} barGap={1}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")} />
              <Bar dataKey="fixed" name={`AC at ${fmtF(BASELINE_AC_C)}`} fill="var(--line-strong)" isAnimationActive={false} />
              <Bar dataKey="model" name="Model" fill="var(--cold)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

/** Each two-month bill priced on its own (tiers restart every bill), then added up. */
function BillsView({ totals }: { totals: EnergyTotals }) {
  if (!totals.bills.length) {
    return <p className="model-hint">Press Next hour or Next week. Every two months of simulated time is one LADWP bill.</p>;
  }
  const sum = (pick: (b: EnergyTotals["bills"][number]) => number) => totals.bills.reduce((s, b) => s + pick(b), 0);
  return (
    <div className="bills">
      <table>
        <thead>
          <tr>
            <th scope="col">Bill</th>
            <th scope="col">Fixed {fmtF(BASELINE_AC_C)}</th>
            <th scope="col">Model</th>
            <th scope="col">Saved</th>
          </tr>
        </thead>
        <tbody>
          {totals.bills.map((b) => (
            <tr key={b.key}>
              <th scope="row">
                {b.label}
                <span>{b.hours < 24 * 59 ? ` · ${Math.round(b.hours / 24)} d so far` : ""}</span>
              </th>
              <td>
                {money(b.fixedCost)}
                <span>{Math.round(b.fixedKwh).toLocaleString("en-US")} kWh</span>
              </td>
              <td>
                {money(b.modelCost)}
                <span>{Math.round(b.modelKwh).toLocaleString("en-US")} kWh</span>
              </td>
              <td className="save">{money(b.fixedCost - b.modelCost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{money(sum((b) => b.fixedCost))}</td>
            <td>{money(sum((b) => b.modelCost))}</td>
            <td className="save">{money(sum((b) => b.fixedCost - b.modelCost))}</td>
          </tr>
        </tfoot>
      </table>
      <p className="energy-source">
        LADWP R-1A, Zone 1, 2026 prices with adjustment factors. Each bill starts at Tier 1: first 700 kWh, next 1,400 kWh, then Tier 3.
        Power Access Charge and city tax not included.
      </p>
    </div>
  );
}
