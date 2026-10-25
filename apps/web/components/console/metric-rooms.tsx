import { energyDeltaLabel } from "../../lib/thermal";
import { deltaTone, type RoomSnapshot } from "../../lib/campus-summary";
import { ActionBadge } from "./action-badge";
import { fmtF } from "../../lib/units";

export function MetricRooms({
  rooms,
  selectedId,
  onSelect,
}: {
  rooms: RoomSnapshot[];
  selectedId: string;
  onSelect: (spaceId: string) => void;
}) {
  return (
    <div>
      <div className="metric-head" aria-hidden="true">
        <span>Room</span>
        <span>Indoor</span>
        <span>People</span>
        <span>Hot · cold</span>
        <span>Call</span>
        <span>This hour</span>
      </div>
      {rooms.length === 0 ? (
        <p className="note">No rooms match.</p>
      ) : (
        <div className="metric-board">
          {rooms.map((room) => {
            const tone = deltaTone(room.result.savedKwh);
            return (
              <button
                key={room.space.id}
                type="button"
                className="metric-row"
                aria-pressed={room.space.id === selectedId}
                onClick={() => onSelect(room.space.id)}
              >
                <span className="metric-room">
                  <strong>{room.space.name}</strong>
                  <small>
                    {room.space.building}
                    {room.reading.scheduledOpen ? "" : " · Closed"}
                  </small>
                </span>
                <span className="metric-cell">
                  <span className="metric-label">Indoor</span>
                  {fmtF(room.reading.indoorC)}
                </span>
                <span className="metric-cell">
                  <span className="metric-label">People</span>
                  {Math.round(room.reading.occupancy)}
                </span>
                <span className="metric-cell">
                  <span className="metric-label">Hot and cold</span>
                  <span className="metric-votes">
                    <span className="hot">{Math.round(room.reading.hotVotes)}</span>
                    <span className="cold">{Math.round(room.reading.coldVotes)}</span>
                  </span>
                </span>
                <span className="metric-cell">
                  <span className="metric-label">Call</span>
                  <ActionBadge action={room.result.action} />
                </span>
                <span className="metric-cell">
                  <span className="metric-label">This hour</span>
                  <span className={tone === "even" ? "quiet" : tone}>
                    {energyDeltaLabel(room.result.savedKwh)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
