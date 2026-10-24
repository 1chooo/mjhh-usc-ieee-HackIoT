import type { Vote } from "../../lib/campus";
import type { RoomSnapshot } from "../../lib/campus-summary";
import { ResultBlock, VoteMeter } from "../result-block";

export function RoomDetail({
  room,
  mode,
  myVote,
  ready,
  onToggleOpen,
  onVote,
  onClearVote,
}: {
  room: RoomSnapshot;
  mode: "admin" | "public";
  myVote?: Vote;
  ready: boolean;
  onToggleOpen?: (open: boolean) => void;
  onVote?: (vote: Vote) => void;
  onClearVote?: () => void;
}) {
  const { space, reading, result } = room;

  return (
    <section className="stack">
      <header>
        <p className="kicker">{space.building}</p>
        {mode === "public" ? <h1>{space.name}</h1> : <h2>{space.name}</h2>}
      </header>
      <dl className="stat-grid">
        <div>
          <dt>Indoor</dt>
          <dd>{reading.indoorC.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt>Outside</dt>
          <dd>{reading.outdoorC.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{Math.round(reading.humidityPct)}%</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>{Math.round(reading.occupancy)}</dd>
        </div>
      </dl>
      {mode === "admin" ? (
        <div className="stack">
          <div className="choice-row">
            <button
              type="button"
              className="ghost"
              aria-pressed={reading.scheduledOpen}
              disabled={!ready}
              onClick={() => onToggleOpen?.(!reading.scheduledOpen)}
            >
              {reading.scheduledOpen ? "Open" : "Closed"}
            </button>
          </div>
          <div className="vote-row">
            <button
              type="button"
              className="vote hot"
              aria-pressed={myVote === "hot"}
              disabled={!ready}
              onClick={() => onVote?.("hot")}
            >
              Too hot
            </button>
            <button
              type="button"
              className="vote cold"
              aria-pressed={myVote === "cold"}
              disabled={!ready}
              onClick={() => onVote?.("cold")}
            >
              Too cold
            </button>
            {myVote ? (
              <button className="ghost" type="button" onClick={() => onClearVote?.()}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ResultBlock result={result} />
      <VoteMeter hot={reading.hotVotes} cold={reading.coldVotes} />
    </section>
  );
}
