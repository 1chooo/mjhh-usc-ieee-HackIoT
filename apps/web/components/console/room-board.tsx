"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLiveRoom } from "../../lib/use-live-room";
import { Card, CardContent } from "../ui/card";
import { StatGrid } from "./stat-grid";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  color: "var(--ink)",
};

const axisTick = { fill: "var(--muted)", fontSize: 12 };
const grid = "var(--line)";

function formatTemp(tempC: number | null): string {
  return tempC == null ? "—" : `${tempC.toFixed(1)}°C`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RoomBoard() {
  const { room, error } = useLiveRoom();
  const points = [...(room?.history ?? [])].reverse().map((row) => ({
    at: row.created_at,
    temp: row.temp_c,
    people: row.ppl,
  }));

  return (
    <div className="stack">
      <h1>Rooms</h1>
      {room == null && error == null ? <p className="note">Loading…</p> : null}
      {error ? (
        <p className="note" role="alert">
          {error}
        </p>
      ) : null}
      {room ? (
        <>
          <StatGrid
            items={[
              {
                label: "Temperature",
                value: room.record ? formatTemp(room.record.temp_c) : "—",
              },
              {
                label: "People",
                value: room.record ? String(room.record.ppl) : "—",
              },
              {
                label: "Setpoint",
                value: room.setpoint
                  ? `${room.setpoint.target_c.toFixed(1)}°C`
                  : "—",
              },
              {
                label: "Votes",
                value: `${room.hot} hot · ${room.cold} cold`,
              },
            ]}
          />
          <Card className="border-border bg-card shadow-none">
            <CardContent
              className="h-72"
              role="img"
              aria-label="Temperature and people"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis
                    dataKey="at"
                    tick={axisTick}
                    tickFormatter={formatWhen}
                    minTickGap={28}
                  />
                  <YAxis yAxisId="temp" tick={axisTick} width={48} unit="°" />
                  <YAxis
                    yAxisId="people"
                    orientation="right"
                    tick={axisTick}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatWhen(String(label))}
                  />
                  <Legend />
                  <Line
                    yAxisId="temp"
                    dataKey="temp"
                    name="°C"
                    stroke="var(--ink)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="people"
                    dataKey="people"
                    name="People"
                    stroke="var(--cold)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
