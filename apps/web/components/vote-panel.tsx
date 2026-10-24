"use client";

import Link from "next/link";
import { evaluateSpace, getSpace } from "../lib/campus";
import { useCampus } from "../lib/use-campus";
import { ResultBlock, VoteMeter } from "./result-block";

export function VotePanel({ spaceId }: { spaceId: string }) {
  const space = getSpace(spaceId);
  const campus = useCampus();
  if (!space) {
    return null;
  }
  const reading = campus.readings[space.id];
  if (!reading) {
    return null;
  }
  const result = evaluateSpace(space, reading);
  const mine = campus.myVotes[space.id];

  return (
    <article className="stack">
      <header className="page-head">
        <p className="eyebrow">
          {space.building} · {space.kind} · {space.floorAreaM2} m²
        </p>
        <h1>{space.name}</h1>
        <p className="lede">{space.note}</p>
      </header>
      <dl className="stat-grid">
        <div>
          <dt>Indoor sensor</dt>
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
          <dt>People here</dt>
          <dd>
            {Math.round(reading.occupancy)}
            {reading.scheduledOpen ? "" : " · closed"}
          </dd>
        </div>
      </dl>
      <section className="vote-panel">
        <h2>How does this room feel?</h2>
        <p>
          One vote from this browser. Switching replaces the previous choice.
        </p>
        <div className="vote-row">
          <button
            type="button"
            className="vote hot"
            aria-pressed={mine === "hot"}
            disabled={!campus.ready}
            onClick={() => campus.castVote(space.id, "hot")}
          >
            Too hot
          </button>
          <button
            type="button"
            className="vote cold"
            aria-pressed={mine === "cold"}
            disabled={!campus.ready}
            onClick={() => campus.castVote(space.id, "cold")}
          >
            Too cold
          </button>
        </div>
        <p>
          {mine
            ? `Your vote is ${mine}.`
            : campus.ready
              ? "You have not voted in this room."
              : "Loading the vote saved in this browser."}
        </p>
        {mine ? (
          <button
            className="ghost"
            type="button"
            onClick={() => campus.clearVote(space.id)}
          >
            Clear my vote
          </button>
        ) : null}
        <VoteMeter hot={reading.hotVotes} cold={reading.coldVotes} />
      </section>
      <ResultBlock result={result} />
      {!reading.scheduledOpen ? (
        <p className="note">
          This room is closed, so the model stores your vote and does not let it
          move the setpoint until the room is open and someone is in it.
        </p>
      ) : null}
      <p>
        <Link className="text-link" href={`/simulator?space=${space.id}`}>
          Try this room in the simulator
        </Link>
      </p>
    </article>
  );
}
