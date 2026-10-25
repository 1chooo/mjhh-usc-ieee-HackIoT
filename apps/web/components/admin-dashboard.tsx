"use client";

import { type RoomLive, type RoomRecord } from "../lib/supabase-rest";
import { useLiveRoom } from "../lib/use-live-room";
import { StatGrid } from "./console/stat-grid";
import { VoteMeter } from "./result-block";

function formatUsd(value: number): string {
  const amount = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  return value < 0 ? `-$${amount}` : `$${amount}`;
}

function formatTemp(tempC: number | null): string {
  return tempC == null ? "No reading" : `${tempC.toFixed(1)}°C`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function exportRoom(room: RoomLive) {
  const payload = {
    exportedAt: new Date().toISOString(),
    record: room.record,
    history: room.history,
    hot: room.hot,
    cold: room.cold,
    setpoint: room.setpoint,
    savings: room.savings,
    totalUsd: room.totalUsd,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `room-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function RecentRecords({ records }: { records: RoomRecord[] }) {
  if (records.length === 0) {
    return <p className="note">No readings yet.</p>;
  }

  return (
    <div className="bills">
      <table>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">People</th>
            <th scope="col">Temperature</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id}>
              <th scope="row">{formatWhen(row.created_at)}</th>
              <td>{row.ppl}</td>
              <td>{formatTemp(row.temp_c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDashboard() {
  const { room, error } = useLiveRoom();

  const latestSaving = room?.savings[room.savings.length - 1];
  const latestUsd = latestSaving ? Number(latestSaving.saved_usd) : Number.NaN;
  const savedTone =
    room == null || room.totalUsd === 0
      ? undefined
      : room.totalUsd > 0
        ? "save"
        : "spend";

  return (
    <div className="stack">
      <div className="page-tools">
        <h1>Dashboard</h1>
        <div className="choice-row">
          <button
            className="ghost"
            type="button"
            onClick={() => {
              if (room) exportRoom(room);
            }}
            disabled={!room}
          >
            Export
          </button>
        </div>
      </div>
      {room == null && error == null ? (
        <p className="note">Loading the room…</p>
      ) : null}
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
                value: room.record
                  ? formatTemp(room.record.temp_c)
                  : "No reading",
              },
              {
                label: "People",
                value: room.record ? String(room.record.ppl) : "—",
              },
              {
                label: "Setpoint",
                value: room.setpoint
                  ? `${room.setpoint.target_c.toFixed(1)}°C`
                  : "No target",
              },
              {
                label: "Saved",
                value: formatUsd(room.totalUsd),
                tone: savedTone,
              },
            ]}
          />
          <p className="note">
            {Number.isFinite(latestUsd)
              ? `Latest cycle ${formatUsd(latestUsd)}`
              : "No savings yet."}
            {room.record
              ? ` · Reading ${formatWhen(room.record.created_at)}`
              : ""}
          </p>
          <VoteMeter hot={room.hot} cold={room.cold} />
          <h2>Recent readings</h2>
          <RecentRecords records={room.history} />
        </>
      ) : null}
    </div>
  );
}
