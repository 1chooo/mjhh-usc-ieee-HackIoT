"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { evaluateSpace, getSpace, spaces } from "../lib/campus";
import { energyDeltaLabel } from "../lib/thermal";
import { useCampus } from "../lib/use-campus";
import { ResultBlock, VoteMeter } from "./result-block";

export function AdminDashboard() {
  const campus = useCampus();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("room");
  const selected = getSpace(requested ?? "") ?? spaces[0];

  const rows = spaces.map((space) => {
    const reading = campus.readings[space.id];
    const result = reading ? evaluateSpace(space, reading) : undefined;
    return { space, reading, result };
  });
  const saved = rows.reduce((sum, row) => sum + (row.result?.savedKwh ?? 0), 0);
  const current = rows.find((row) => row.space.id === selected?.id);
  const reading = current?.reading;
  const result = current?.result;
  const mine = selected ? campus.myVotes[selected.id] : undefined;

  function openRoom(spaceId: string) {
    router.replace(`/dashboard?room=${spaceId}`);
  }

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Rooms</h1>
      </header>
      <dl className="stat-grid">
        <div>
          <dt>Rooms</dt>
          <dd>{spaces.length}</dd>
        </div>
        <div>
          <dt>Versus fixed</dt>
          <dd
            className={saved >= 0.005 ? "save" : saved <= -0.005 ? "spend" : ""}
          >
            {energyDeltaLabel(saved)}
          </dd>
        </div>
        <div>
          <dt>Calls</dt>
          <dd className="stat-note">
            {rows.filter((row) => row.result?.action === "cool").length} cool ·{" "}
            {rows.filter((row) => row.result?.action === "heat").length} heat ·{" "}
            {rows.filter((row) => row.result?.action === "hold").length} hold
          </dd>
        </div>
        <div>
          <dt>Votes</dt>
          <dd>{Object.keys(campus.myVotes).length}</dd>
        </div>
      </dl>
      <div className="split">
        <div className="room-picker" role="listbox" aria-label="Rooms">
          {rows.map(({ space, result: rowResult }) => (
            <button
              key={space.id}
              type="button"
              className="ghost"
              role="option"
              aria-selected={space.id === selected?.id}
              onClick={() => openRoom(space.id)}
            >
              <span>
                <strong>{space.name}</strong>
                <small>{space.building}</small>
              </span>
              <span
                className={rowResult ? `badge ${rowResult.action}` : "badge"}
              >
                {rowResult?.action ?? "hold"}
              </span>
            </button>
          ))}
        </div>
        {selected && reading && result ? (
          <section className="stack result-card">
            <header>
              <h2>{selected.name}</h2>
            </header>
            <div className="choice-row">
              <button
                type="button"
                className="ghost"
                aria-pressed={reading.scheduledOpen}
                disabled={!campus.ready}
                onClick={() =>
                  campus.setRoomOpen(selected.id, !reading.scheduledOpen)
                }
              >
                {reading.scheduledOpen ? "Room is open" : "Room is closed"}
              </button>
              <Link className="ghost" href={`/simulator?space=${selected.id}`}>
                Open in the simulator
              </Link>
            </div>
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
            <section className="vote-panel">
              <div className="vote-row">
                <button
                  type="button"
                  className="vote hot"
                  aria-pressed={mine === "hot"}
                  disabled={!campus.ready}
                  onClick={() => campus.castVote(selected.id, "hot")}
                >
                  Too hot
                </button>
                <button
                  type="button"
                  className="vote cold"
                  aria-pressed={mine === "cold"}
                  disabled={!campus.ready}
                  onClick={() => campus.castVote(selected.id, "cold")}
                >
                  Too cold
                </button>
              </div>
              {mine ? (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => campus.clearVote(selected.id)}
                >
                  Clear my vote
                </button>
              ) : null}
              <VoteMeter hot={reading.hotVotes} cold={reading.coldVotes} />
            </section>
            <ResultBlock result={result} />
            {reading.scheduledOpen ? null : (
              <p className="note">
                This room is closed, so a vote is stored and does not move the
                setpoint until the room is open and someone is in it.
              </p>
            )}
          </section>
        ) : null}
      </div>
      <button
        className="ghost"
        type="button"
        onClick={campus.reset}
        disabled={!campus.ready}
      >
        Reset votes and readings
      </button>
    </div>
  );
}
