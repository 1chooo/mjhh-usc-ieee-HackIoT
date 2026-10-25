"use client";

import { useState } from "react";
import type { Vote } from "../lib/campus";

const sides: { vote: Vote; label: string; hint: string }[] = [
  { vote: "cold", label: "Cold", hint: "Too cold in here" },
  { vote: "hot", label: "Hot", hint: "Too hot in here" },
];

function VoteIcon({ vote }: { vote: Vote }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      className="vote-icon"
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {vote === "hot" ? (
        <>
          <circle cx="50" cy="50" r="18" fill="currentColor" />
          {rays.map((angle) => (
            <line
              key={angle}
              x1="50"
              y1="12"
              x2="50"
              y2="22"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
        </>
      ) : (
        [0, 60, 120].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 50 50)`}>
            <line x1="50" y1="10" x2="50" y2="90" />
            <polyline points="40,18 50,28 60,18" />
            <polyline points="40,82 50,72 60,82" />
          </g>
        ))
      )}
    </svg>
  );
}

// Not wired up yet. Replace with the backend call.
async function submitVote(vote: Vote): Promise<void> {
  void vote;
}

export function VoteView() {
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [sending, setSending] = useState(false);

  async function vote(next: Vote) {
    setSending(true);
    try {
      await submitVote(next);
      setMyVote(next);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <h1>Vote</h1>
      <div className="vote-split">
        {sides.map((side) => (
          <button
            key={side.vote}
            type="button"
            className={`vote-side ${side.vote}`}
            aria-pressed={myVote === side.vote}
            disabled={sending}
            onClick={() => void vote(side.vote)}
          >
            <VoteIcon vote={side.vote} />
            <strong>{side.label}</strong>
            <span>{myVote === side.vote ? "Vote sent" : side.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
