import Link from "next/link";
import { energyDeltaLabel } from "../../lib/thermal";
import type { RoomSnapshot } from "../../lib/campus-summary";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ActionBadge } from "./action-badge";

export function BuildingBoard({ rooms }: { rooms: RoomSnapshot[] }) {
  const groups: { building: string; rooms: RoomSnapshot[] }[] = [];
  for (const room of rooms) {
    const existing = groups.find((group) => group.building === room.space.building);
    if (existing) {
      existing.rooms.push(room);
    } else {
      groups.push({ building: room.space.building, rooms: [room] });
    }
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.building} className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-medium">{group.building}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {group.rooms.map((room) => (
              <Link
                key={room.space.id}
                href={`/rooms/${room.space.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{room.space.name}</span>
                  <span className="block font-mono text-sm text-muted-foreground">
                    {room.reading.indoorC.toFixed(1)}°C · {energyDeltaLabel(room.result.savedKwh)}
                  </span>
                </span>
                <ActionBadge action={room.result.action} />
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
