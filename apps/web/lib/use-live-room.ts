"use client";

import { useEffect, useState } from "react";
import { loadRoom, type RoomLive } from "./supabase-rest";

const pollMs = 3000;

/** Latest room, polled the same way as the dashboard. */
export function useLiveRoom(): {
  room: RoomLive | null;
  error: string | null;
} {
  const [room, setRoom] = useState<RoomLive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await loadRoom();
        if (!cancelled) {
          setRoom(next);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { room, error };
}
