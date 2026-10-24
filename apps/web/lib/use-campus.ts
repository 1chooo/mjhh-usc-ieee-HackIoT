"use client";

import { useEffect, useState } from "react";
import {
  defaultCampusState,
  defaultReadings,
  spaces,
  type CampusState,
  type Reading,
  type Vote,
} from "./campus";

const storageKey = "hackiot.comfort.v1";

function isReading(value: unknown): value is Reading {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.indoorC === "number" &&
    typeof record.outdoorC === "number" &&
    typeof record.humidityPct === "number" &&
    typeof record.occupancy === "number" &&
    typeof record.hotVotes === "number" &&
    typeof record.coldVotes === "number" &&
    typeof record.scheduledOpen === "boolean"
  );
}

function isVote(value: unknown): value is Vote {
  return value === "hot" || value === "cold";
}

function loadCampus(): CampusState {
  const fallback = defaultCampusState();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return fallback;
    }
    const record = parsed as Record<string, unknown>;
    const readings = { ...fallback.readings };
    if (typeof record.readings === "object" && record.readings !== null) {
      for (const space of spaces) {
        const candidate = (record.readings as Record<string, unknown>)[
          space.id
        ];
        if (isReading(candidate)) {
          readings[space.id] = candidate;
        }
      }
    }
    const myVotes: Record<string, Vote> = {};
    if (typeof record.myVotes === "object" && record.myVotes !== null) {
      for (const space of spaces) {
        const candidate = (record.myVotes as Record<string, unknown>)[space.id];
        if (isVote(candidate)) {
          myVotes[space.id] = candidate;
        }
      }
    }
    return { readings, myVotes };
  } catch {
    return fallback;
  }
}

function saveCampus(state: CampusState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function useCampus() {
  const [state, setState] = useState<CampusState>(defaultCampusState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadCampus());
    setReady(true);
  }, []);

  function update(next: CampusState) {
    saveCampus(next);
    setState(next);
  }

  function castVote(spaceId: string, vote: Vote) {
    if (!ready || !defaultReadings[spaceId]) {
      return;
    }
    const reading = state.readings[spaceId];
    if (!reading) {
      return;
    }
    const previous = state.myVotes[spaceId];
    if (previous === vote) {
      return;
    }
    const nextReading: Reading = { ...reading };
    if (previous === "hot") {
      nextReading.hotVotes = Math.max(0, nextReading.hotVotes - 1);
    }
    if (previous === "cold") {
      nextReading.coldVotes = Math.max(0, nextReading.coldVotes - 1);
    }
    if (vote === "hot") {
      nextReading.hotVotes += 1;
    } else {
      nextReading.coldVotes += 1;
    }
    update({
      readings: { ...state.readings, [spaceId]: nextReading },
      myVotes: { ...state.myVotes, [spaceId]: vote },
    });
  }

  function clearVote(spaceId: string) {
    if (!ready) {
      return;
    }
    const previous = state.myVotes[spaceId];
    const reading = state.readings[spaceId];
    if (!previous || !reading) {
      return;
    }
    const nextReading: Reading = { ...reading };
    if (previous === "hot") {
      nextReading.hotVotes = Math.max(0, nextReading.hotVotes - 1);
    } else {
      nextReading.coldVotes = Math.max(0, nextReading.coldVotes - 1);
    }
    const myVotes = { ...state.myVotes };
    delete myVotes[spaceId];
    update({
      readings: { ...state.readings, [spaceId]: nextReading },
      myVotes,
    });
  }

  function setRoomOpen(spaceId: string, scheduledOpen: boolean) {
    if (!ready) {
      return;
    }
    const reading = state.readings[spaceId];
    if (!reading || reading.scheduledOpen === scheduledOpen) {
      return;
    }
    update({
      readings: {
        ...state.readings,
        [spaceId]: { ...reading, scheduledOpen },
      },
      myVotes: state.myVotes,
    });
  }

  function reset() {
    update(defaultCampusState());
  }

  return { ready, ...state, castVote, clearVote, setRoomOpen, reset };
}
