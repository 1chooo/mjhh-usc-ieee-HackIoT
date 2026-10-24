import Link from "next/link";
import { energyDeltaLabel } from "../../lib/thermal";
import type { RoomSnapshot } from "../../lib/campus-summary";
import { deltaTone } from "../../lib/campus-summary";
import { cn } from "../../lib/utils";
import { ActionBadge } from "./action-badge";

const toneClass = {
  save: "save",
  spend: "spend",
  even: "text-muted-foreground",
} as const;

function RoomCells({
  room,
  variant,
}: {
  room: RoomSnapshot;
  variant: "status" | "energy";
}) {
  return (
    <>
      <span className="col-span-2 min-w-0 md:col-span-1">
        <span className="block font-medium">{room.space.name}</span>
        <span className="block text-sm text-muted-foreground">
          {room.space.building}
        </span>
      </span>
      <span className="font-mono text-sm">{room.reading.indoorC.toFixed(1)}°C</span>
      <span className="font-mono text-sm">{Math.round(room.reading.occupancy)}</span>
      {variant === "status" ? (
        <span>{room.reading.scheduledOpen ? "Open" : "Closed"}</span>
      ) : (
        <ActionBadge action={room.result.action} />
      )}
      {variant === "status" ? (
        <ActionBadge action={room.result.action} />
      ) : (
        <span className={cn("font-mono text-sm", toneClass[deltaTone(room.result.savedKwh)])}>
          {energyDeltaLabel(room.result.savedKwh)}
        </span>
      )}
    </>
  );
}

export function RoomStream({
  rooms,
  query,
  onQuery,
  variant,
  selectedId,
  onSelect,
  hrefFor,
}: {
  rooms: RoomSnapshot[];
  query: string;
  onQuery: (query: string) => void;
  variant: "status" | "energy";
  selectedId?: string;
  onSelect?: (spaceId: string) => void;
  hrefFor?: (spaceId: string) => string;
}) {
  const columns =
    "md:grid-cols-[1.4fr_0.6fr_0.5fr_0.6fr_0.8fr]";

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border p-3">
        <label className="block">
          <span className="sr-only">Search rooms</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div
        className={cn(
          "hidden gap-3 px-4 py-2 text-xs text-muted-foreground md:grid",
          columns,
        )}
      >
        <span>Room</span>
        <span>Indoor</span>
        <span>People</span>
        <span>{variant === "status" ? "Open" : "Call"}</span>
        <span>{variant === "status" ? "Call" : "This hour"}</span>
      </div>
      {rooms.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">No rooms match.</p>
      ) : (
        <ul className="max-h-[32rem] overflow-auto">
          {rooms.map((room) => {
            const selected = room.space.id === selectedId;
            const className = cn(
              "grid w-full grid-cols-2 gap-2 border-t border-border px-4 py-3 text-left hover:bg-accent md:items-center",
              columns,
              selected && "bg-accent",
            );
            const cells = <RoomCells room={room} variant={variant} />;
            return (
              <li key={room.space.id}>
                {hrefFor ? (
                  <Link href={hrefFor(room.space.id)} className={className}>
                    {cells}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect?.(room.space.id)}
                    className={className}
                  >
                    {cells}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
