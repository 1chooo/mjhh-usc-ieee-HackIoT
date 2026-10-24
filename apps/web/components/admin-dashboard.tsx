"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSpace, spaces } from "../lib/campus";
import {
  deltaTone,
  filterRooms,
  searchRooms,
  summarizeCampus,
  type ActionFilter,
  type KindFilter,
} from "../lib/campus-summary";
import { energyDeltaLabel } from "../lib/thermal";
import { useCampus } from "../lib/use-campus";
import { RoomAlerts } from "./console/room-alerts";
import { RoomDetail } from "./console/room-detail";
import { RoomFilters } from "./console/room-filters";
import { RoomStream } from "./console/room-stream";
import { StatGrid } from "./console/stat-grid";

export function AdminDashboard() {
  const campus = useCampus();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("room");
  const selectedSpace = getSpace(requested ?? "") ?? spaces[0];
  const summary = summarizeCampus(campus.readings);
  const [kind, setKind] = useState<KindFilter>("all");
  const [action, setAction] = useState<ActionFilter>("all");
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const rooms = searchRooms(filterRooms(summary.rooms, kind, action), query);
  const alerts = summary.alerts.filter((alert) => !dismissed.includes(alert.id));
  const selected = summary.rooms.find((room) => room.space.id === selectedSpace?.id);
  const tone = deltaTone(summary.savedKwh);

  function openRoom(spaceId: string) {
    router.replace(`/dashboard?room=${spaceId}`);
  }

  function exportReadings() {
    const payload = {
      exportedAt: new Date().toISOString(),
      rooms: summary.rooms.map((room) => ({
        id: room.space.id,
        name: room.space.name,
        building: room.space.building,
        kind: room.space.kind,
        reading: room.reading,
        action: room.result.action,
        baselineKwh: room.result.baselineKwh,
        adaptiveKwh: room.result.adaptiveKwh,
        savedKwh: room.result.savedKwh,
        targetC: room.result.targetC,
        baselineSetpointC: room.result.baselineSetpointC,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campus-energy-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!selected) {
    return null;
  }

  return (
    <div className="stack">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>Dashboard</h1>
        <div className="choice-row">
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setDismissed([]);
              campus.reset();
            }}
            disabled={!campus.ready}
          >
            Reset
          </button>
          <button
            className="ghost"
            type="button"
            onClick={exportReadings}
            disabled={!campus.ready}
          >
            Export
          </button>
          <Link className="ghost" href={`/simulator?space=${selected.space.id}`}>
            Simulator
          </Link>
        </div>
      </div>
      <StatGrid
        items={[
          {
            label: "This hour",
            value: energyDeltaLabel(summary.savedKwh),
            tone: tone === "even" ? undefined : tone,
          },
          { label: "Rooms", value: String(summary.roomCount) },
          { label: "Votes", value: String(Object.keys(campus.myVotes).length) },
          {
            label: "Calls",
            value: `${summary.cool} cool · ${summary.heat} heat · ${summary.hold} hold`,
          },
        ]}
      />
      <RoomFilters
        kind={kind}
        action={action}
        onKind={setKind}
        onAction={setAction}
        onClear={() => {
          setKind("all");
          setAction("all");
        }}
      />
      <RoomAlerts
        alerts={alerts}
        onDismiss={(id) =>
          setDismissed((current) =>
            current.includes(id) ? current : [...current, id],
          )
        }
      />
      <div className="split">
        <RoomStream
          rooms={rooms}
          query={query}
          onQuery={setQuery}
          variant="energy"
          selectedId={selected.space.id}
          onSelect={openRoom}
        />
        <RoomDetail
          room={selected}
          mode="admin"
          myVote={campus.myVotes[selected.space.id]}
          ready={campus.ready}
          onToggleOpen={(open) => campus.setRoomOpen(selected.space.id, open)}
          onVote={(vote) => campus.castVote(selected.space.id, vote)}
          onClearVote={() => campus.clearVote(selected.space.id)}
        />
      </div>
    </div>
  );
}
