"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RoomSnapshot } from "../../lib/campus-summary";
import { Card, CardContent } from "../ui/card";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  color: "var(--ink)",
};

const axisTick = { fill: "var(--muted)", fontSize: 12 };
const grid = "var(--line)";

export function EnergyCharts({ rooms }: { rooms: RoomSnapshot[] }) {
  const energy = rooms.map((room) => ({
    name: room.space.name,
    fixed: Number(room.result.baselineKwh.toFixed(2)),
    policy: Number(room.result.adaptiveKwh.toFixed(2)),
  }));
  const votes = rooms.map((room) => ({
    name: room.space.name,
    hot: room.reading.hotVotes,
    cold: room.reading.coldVotes,
  }));
  const calls = [
    { name: "Cool", count: rooms.filter((room) => room.result.action === "cool").length },
    { name: "Heat", count: rooms.filter((room) => room.result.action === "heat").length },
    { name: "Hold", count: rooms.filter((room) => room.result.action === "hold").length },
  ];
  const callColors = ["var(--cold)", "var(--hot)", "var(--muted)"];

  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground">No rooms match.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border bg-card shadow-none lg:col-span-2">
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={energy}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis tick={axisTick} unit=" kWh" width={72} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="fixed" name="Fixed" fill="var(--cold)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="policy" name="Policy" fill="var(--save)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-border bg-card shadow-none">
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={votes}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis tick={axisTick} allowDecimals={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="hot" name="Hot" fill="var(--hot)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cold" name="Cold" fill="var(--cold)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-border bg-card shadow-none">
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={calls}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis tick={axisTick} allowDecimals={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Rooms" radius={[4, 4, 0, 0]}>
                {calls.map((call, index) => (
                  <Cell key={call.name} fill={callColors[index] ?? "var(--ink)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
