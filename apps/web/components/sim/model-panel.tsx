"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ModelResult } from "../../lib/model-sim";

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
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  color: "var(--ink)",
  fontSize: 12,
};
const axisTick = { fill: "var(--muted)", fontSize: 11 };
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

export function ModelPanel({
  clock,
  result,
  history,
  onNextHour,
  onNextWeek,
  onReset,
}: {
  clock: string;
  result: ModelResult;
  history: HourLog[];
  onNextHour: () => void;
  onNextWeek: () => void;
  onReset: () => void;
}) {
  const m = result.model;
  const group = m.group ? `G${String(m.group.gid).padStart(2, "0")}` : "drop-in";
  const data = history.map((h, i) => ({
    i: i + 1,
    label: h.label,
    setpoint: h.setpointC,
    room: Number(h.roomC.toFixed(1)),
    want: h.wantC,
  }));
  return (
    <div className="result-card model-card">
      <div className="model-head">
        <strong>{clock}</strong>
        <span>
          {group} · learned {m.learnedHours - 1} h
        </span>
      </div>
      <p className="model-math">
        curve {m.curveC.toFixed(1)}°C {signed(m.offsetC)} group = {(m.curveC + m.offsetC).toFixed(1)}°C · votes{" "}
        {signed(m.correctionC)} → AC <strong>{result.targetC.toFixed(1)}°C</strong>, room ≈ {result.roomAfterC.toFixed(1)}°C
      </p>
      <div className="choice-row">
        <button type="button" className="ghost" onClick={onNextHour}>
          Next hour
        </button>
        <button type="button" className="ghost" onClick={onNextWeek}>
          Same time next week
        </button>
        <button type="button" className="ghost" onClick={onReset}>
          Reset learning
        </button>
      </div>
      {data.length ? (
        <div className="model-chart" aria-label="AC setpoint and room temperature by hour">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="i" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")}
              />
              <Line type="stepAfter" dataKey="setpoint" name="AC setpoint" stroke="var(--cold)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="room" name="Room" stroke="var(--ink)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="want" name="Group wants" stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="model-hint">Press Next hour: the model learns from this hour’s votes and the room reacts.</p>
      )}
    </div>
  );
}
