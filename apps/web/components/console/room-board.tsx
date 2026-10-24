"use client";

import { useState } from "react";
import { defaultReadings } from "../../lib/campus";
import {
  filterRooms,
  searchRooms,
  summarizeCampus,
  type ActionFilter,
  type KindFilter,
} from "../../lib/campus-summary";
import { RoomAlerts } from "./room-alerts";
import { RoomFilters } from "./room-filters";
import { RoomStream } from "./room-stream";
import { StatGrid } from "./stat-grid";

export function RoomBoard() {
  const summary = summarizeCampus(defaultReadings);
  const [kind, setKind] = useState<KindFilter>("all");
  const [action, setAction] = useState<ActionFilter>("all");
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const rooms = searchRooms(filterRooms(summary.rooms, kind, action), query);
  const alerts = summary.alerts.filter((alert) => !dismissed.includes(alert.id));
  const open = summary.rooms.filter((room) => room.reading.scheduledOpen).length;

  return (
    <div className="stack">
      <h1>Rooms</h1>
      <StatGrid
        items={[
          { label: "Rooms", value: String(summary.roomCount) },
          { label: "Open", value: String(open) },
          { label: "People", value: String(Math.round(summary.openPeople)) },
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
      <RoomStream
        rooms={rooms}
        query={query}
        onQuery={setQuery}
        variant="status"
        hrefFor={(spaceId) => `/rooms/${spaceId}`}
      />
    </div>
  );
}
