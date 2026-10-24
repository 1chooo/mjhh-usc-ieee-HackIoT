"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSpace, spaces } from "../lib/campus";
import {
  deltaTone,
  filterRooms,
  summarizeCampus,
  type ActionFilter,
  type KindFilter,
} from "../lib/campus-summary";
import { energyDeltaLabel } from "../lib/thermal";
import { useCampus } from "../lib/use-campus";
import { MetricRooms } from "./console/metric-rooms";
import { RoomDetail } from "./console/room-detail";
import { StatGrid } from "./console/stat-grid";
import { EnergyCompare } from "./result-block";

const kinds: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All rooms" },
  { id: "library", label: "Library" },
  { id: "classroom", label: "Classroom" },
];

const actions: { id: ActionFilter; label: string }[] = [
  { id: "all", label: "All calls" },
  { id: "cool", label: "Cool" },
  { id: "heat", label: "Heat" },
  { id: "hold", label: "Hold" },
];

export function AdminDashboard() {
  const campus = useCampus();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("room");
  const selectedSpace = getSpace(requested ?? "") ?? spaces[0];
  const summary = summarizeCampus(campus.readings);
  const [kind, setKind] = useState<KindFilter>("all");
  const [action, setAction] = useState<ActionFilter>("all");
  const rooms = filterRooms(summary.rooms, kind, action);
  const selected = summary.rooms.find((room) => room.space.id === selectedSpace?.id);
  const tone = deltaTone(summary.savedKwh);
  const filtered = kind !== "all" || action !== "all";

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
      <div className="page-tools">
        <h1>Dashboard</h1>
        <div className="choice-row">
          <button
            className="ghost"
            type="button"
            onClick={() => campus.reset()}
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
      <div className="metric-summary">
        <StatGrid
          items={[
            {
              label: "This hour",
              value: energyDeltaLabel(summary.savedKwh),
              tone: tone === "even" ? undefined : tone,
            },
            { label: "Rooms", value: String(summary.roomCount) },
            { label: "People", value: String(Math.round(summary.openPeople)) },
            {
              label: "Calls",
              value: `${summary.cool} cool · ${summary.heat} heat · ${summary.hold} hold`,
            },
          ]}
        />
        <EnergyCompare
          baselineKwh={summary.baselineKwh}
          adaptiveKwh={summary.adaptiveKwh}
        />
      </div>
      <div className="choice-row">
        {kinds.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ghost"
            aria-pressed={kind === item.id}
            onClick={() => setKind(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className="choice-gap" aria-hidden="true" />
        {actions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ghost"
            aria-pressed={action === item.id}
            onClick={() => setAction(item.id)}
          >
            {item.label}
          </button>
        ))}
        {filtered ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setKind("all");
              setAction("all");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="admin-split">
        <MetricRooms
          rooms={rooms}
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
