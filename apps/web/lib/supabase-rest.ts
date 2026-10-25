// Supabase REST for the one live room. See apps/backend/API.md.
// The publishable key may read every table and insert a vote. It cannot change or delete rows.

const restUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  "Content-Type": "application/json",
};

const epoch = "1970-01-01T00:00:00Z";
const historyLimit = 48;

export type RoomRecord = {
  id: number;
  ppl: number;
  temp_c: number | null;
  created_at: string;
};

export type RoomSetpoint = {
  id: number;
  target_c: number;
  created_at: string;
};

export type RoomSaving = {
  saved_usd: string | number;
  created_at: string;
};

type VoteFlag = {
  is_hot: boolean;
};

export type RoomLive = {
  record: RoomRecord | null;
  history: RoomRecord[];
  hot: number;
  cold: number;
  setpoint: RoomSetpoint | null;
  savings: RoomSaving[];
  totalUsd: number;
};

export async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${restUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function dollars(savedUsd: string | number): number {
  const amount = typeof savedUsd === "number" ? savedUsd : Number(savedUsd);
  return Number.isFinite(amount) ? amount : 0;
}

/** Votes cast after `since`. With no time, counts from the latest record, or from the epoch when none exists. */
export async function liveVotes(since?: string): Promise<{ hot: number; cold: number }> {
  let at = since;
  if (!at) {
    const latest = await rest<Pick<RoomRecord, "created_at">[]>(
      "/record?select=created_at&order=created_at.desc&limit=1",
    );
    at = latest?.[0]?.created_at ?? epoch;
  }
  const votes =
    (await rest<VoteFlag[]>(`/vote?select=is_hot&created_at=gt.${encodeURIComponent(at)}`)) ??
    [];
  const hot = votes.filter((row) => row.is_hot).length;
  return { hot, cold: votes.length - hot };
}

/** Current room: latest record, recent history, votes since that record, latest setpoint, and savings. */
export async function loadRoom(): Promise<RoomLive> {
  const [history, setpoints, savings] = await Promise.all([
    rest<RoomRecord[]>(
      `/record?select=id,ppl,temp_c,created_at&order=created_at.desc&limit=${historyLimit}`,
    ),
    rest<RoomSetpoint[]>(
      "/setpoint?select=id,target_c,created_at&order=created_at.desc&limit=1",
    ),
    rest<RoomSaving[]>("/saving?select=saved_usd,created_at&order=created_at.asc"),
  ]);
  const records = history ?? [];
  const record = records[0] ?? null;
  const saved = savings ?? [];
  const { hot, cold } = await liveVotes(record?.created_at ?? epoch);
  const totalUnits = saved.reduce(
    (sum, row) => sum + Math.round(dollars(row.saved_usd) * 10000),
    0,
  );
  return {
    record,
    history: records,
    hot,
    cold,
    setpoint: setpoints?.[0] ?? null,
    savings: saved,
    totalUsd: totalUnits / 10000,
  };
}
