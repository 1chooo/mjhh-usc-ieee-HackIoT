"use client";

import { useEffect, useState } from "react";
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

// Supabase REST, see apps/backend/API.md. The publishable key may only read and cast votes.
const restUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  "Content-Type": "application/json",
};

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${restUrl}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function submitVote(vote: Vote): Promise<void> {
  await rest("/vote", { method: "POST", body: JSON.stringify({ is_hot: vote === "hot" }) });
}

// Votes cast since the latest record: the count the Pi will use on its next cycle.
async function fetchLiveCount(): Promise<{ hot: number; cold: number }> {
  const last = await rest<{ created_at: string }[]>(
    "/record?select=created_at&order=created_at.desc&limit=1",
  );
  const since = encodeURIComponent(last[0]?.created_at ?? "1970-01-01T00:00:00Z");
  const votes = await rest<{ is_hot: boolean }[]>(`/vote?select=is_hot&created_at=gt.${since}`);
  const hot = votes.filter((v) => v.is_hot).length;
  return { hot, cold: votes.length - hot };
}

export function VoteView() {
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [sending, setSending] = useState(false);
  const [count, setCount] = useState<{ hot: number; cold: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setCount(await fetchLiveCount());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, []);

  async function vote(next: Vote) {
    setSending(true);
    setError(null);
    try {
      await submitVote(next);
      setMyVote(next);
      await refresh();
    } catch (e) {
      setError(String(e));
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
      <p>
        {count
          ? `This cycle so far: ${count.cold} cold, ${count.hot} hot`
          : "Loading votes…"}
      </p>
      {error && <p role="alert">Vote failed: {error}</p>}
    </div>
  );
}
