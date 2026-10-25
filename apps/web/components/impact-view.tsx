"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLiveRoom } from "../lib/use-live-room";
import { StatGrid } from "./console/stat-grid";
import { Card, CardContent } from "./ui/card";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  color: "var(--ink)",
};

const axisTick = { fill: "var(--muted)", fontSize: 12 };
const grid = "var(--line)";

function formatUsd(value: number): string {
  const amount = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  return value < 0 ? `-$${amount}` : `$${amount}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dollars(savedUsd: string | number): number {
  const amount = typeof savedUsd === "number" ? savedUsd : Number(savedUsd);
  return Number.isFinite(amount) ? amount : 0;
}

function moneyTone(value: number): "save" | "spend" | undefined {
  if (!Number.isFinite(value) || value === 0) return undefined;
  return value > 0 ? "save" : "spend";
}

export function ImpactView() {
  const { room, error } = useLiveRoom();
  const savings = room?.savings ?? [];
  const latest = savings[savings.length - 1];
  const latestUsd = latest ? dollars(latest.saved_usd) : Number.NaN;
  const points = savings.map((row) => ({
    at: row.created_at,
    usd: dollars(row.saved_usd),
  }));

  return (
    <div className="stack">
      <h1>Impact</h1>
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
                label: "Saved",
                value: formatUsd(room.totalUsd),
                tone: moneyTone(room.totalUsd),
              },
              {
                label: "Latest cycle",
                value: Number.isFinite(latestUsd) ? formatUsd(latestUsd) : "—",
                tone: moneyTone(latestUsd),
              },
              { label: "Cycles", value: String(savings.length) },
            ]}
          />
          <Card className="border-border bg-card shadow-none">
            <CardContent className="h-72" role="img" aria-label="Savings">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis
                    dataKey="at"
                    tick={axisTick}
                    tickFormatter={formatWhen}
                    minTickGap={28}
                  />
                  <YAxis
                    tick={axisTick}
                    width={72}
                    tickFormatter={(value: number) => formatUsd(value)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatWhen(String(label))}
                    formatter={(value) => [formatUsd(Number(value)), "Saved"]}
                  />
                  <Bar dataKey="usd" radius={[4, 4, 0, 0]}>
                    {points.map((point) => (
                      <Cell
                        key={point.at}
                        fill={point.usd < 0 ? "var(--spend)" : "var(--save)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
