import {
  defaultReadings,
  evaluateSpace,
  spaces,
  type Reading,
  type Space,
} from "./campus";
import type { HvacAction, ThermalResult } from "./thermal";

export type RoomSnapshot = {
  space: Space;
  reading: Reading;
  result: ThermalResult;
};

export type AlertSeverity = "high" | "medium" | "low";

export type CampusAlert = {
  id: string;
  spaceId: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
};

export type CampusSummary = {
  rooms: RoomSnapshot[];
  roomCount: number;
  savedKwh: number;
  baselineKwh: number;
  adaptiveKwh: number;
  savedPct: number;
  cool: number;
  heat: number;
  hold: number;
  openPeople: number;
  occupancy: number;
  capacity: number;
  voteCount: number;
  alerts: CampusAlert[];
};

export type KindFilter = "all" | Space["kind"];
export type ActionFilter = "all" | HvacAction;

const spendEpsilon = 0.005;
const leanVotes = 4;
const leanShare = 0.7;

function readingFor(
  readings: Record<string, Reading>,
  spaceId: string,
): Reading {
  return (
    readings[spaceId] ??
    defaultReadings[spaceId] ?? {
      indoorC: 0,
      outdoorC: 0,
      humidityPct: 0,
      occupancy: 0,
      hotVotes: 0,
      coldVotes: 0,
      scheduledOpen: false,
    }
  );
}

function alertsFor(room: RoomSnapshot): CampusAlert[] {
  const { space, reading, result } = room;
  const alerts: CampusAlert[] = [];
  if (result.savedKwh < -spendEpsilon) {
    alerts.push({
      id: `${space.id}:spend`,
      spaceId: space.id,
      severity: "high",
      title: `${space.name} is using more than a fixed setpoint`,
      detail: "This hour spends more energy to hold comfort.",
    });
  }
  if (!reading.scheduledOpen) {
    alerts.push({
      id: `${space.id}:closed`,
      spaceId: space.id,
      severity: "low",
      title: `${space.name} is closed`,
      detail:
        "Votes are stored and do not move the setpoint until the room is open and someone is in it.",
    });
  }
  const totalVotes = reading.hotVotes + reading.coldVotes;
  if (reading.scheduledOpen && result.peoplePresent && totalVotes >= leanVotes) {
    const hotShare = reading.hotVotes / totalVotes;
    const lean =
      hotShare >= leanShare ? "hot" : hotShare <= 1 - leanShare ? "cold" : null;
    if (lean) {
      alerts.push({
        id: `${space.id}:lean`,
        spaceId: space.id,
        severity: "medium",
        title: `${space.name} leans ${lean}`,
        detail: `${Math.round(reading.hotVotes)} hot and ${Math.round(reading.coldVotes)} cold in an open room.`,
      });
    }
  }
  return alerts;
}

export function summarizeCampus(
  readings: Record<string, Reading>,
): CampusSummary {
  const rooms = spaces.map((space) => {
    const reading = readingFor(readings, space.id);
    return { space, reading, result: evaluateSpace(space, reading) };
  });
  const savedKwh = rooms.reduce((sum, room) => sum + room.result.savedKwh, 0);
  const baselineKwh = rooms.reduce(
    (sum, room) => sum + room.result.baselineKwh,
    0,
  );
  const adaptiveKwh = rooms.reduce(
    (sum, room) => sum + room.result.adaptiveKwh,
    0,
  );
  return {
    rooms,
    roomCount: rooms.length,
    savedKwh,
    baselineKwh,
    adaptiveKwh,
    savedPct: baselineKwh === 0 ? 0 : (savedKwh / baselineKwh) * 100,
    cool: rooms.filter((room) => room.result.action === "cool").length,
    heat: rooms.filter((room) => room.result.action === "heat").length,
    hold: rooms.filter((room) => room.result.action === "hold").length,
    openPeople: rooms.reduce(
      (sum, room) =>
        sum + (room.reading.scheduledOpen ? room.reading.occupancy : 0),
      0,
    ),
    occupancy: rooms.reduce((sum, room) => sum + room.reading.occupancy, 0),
    capacity: rooms.reduce((sum, room) => sum + room.space.capacity, 0),
    voteCount: rooms.reduce(
      (sum, room) => sum + room.reading.hotVotes + room.reading.coldVotes,
      0,
    ),
    alerts: rooms.flatMap(alertsFor),
  };
}

export function filterRooms(
  rooms: RoomSnapshot[],
  kind: KindFilter,
  action: ActionFilter,
): RoomSnapshot[] {
  return rooms.filter((room) => {
    if (kind !== "all" && room.space.kind !== kind) {
      return false;
    }
    if (action !== "all" && room.result.action !== action) {
      return false;
    }
    return true;
  });
}

export function searchRooms(
  rooms: RoomSnapshot[],
  query: string,
): RoomSnapshot[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return rooms;
  }
  return rooms.filter((room) => {
    const haystack = `${room.space.name} ${room.space.building} ${room.space.kind}`;
    return haystack.toLowerCase().includes(needle);
  });
}

export function deltaTone(savedKwh: number): "save" | "spend" | "even" {
  if (savedKwh > spendEpsilon) {
    return "save";
  }
  if (savedKwh < -spendEpsilon) {
    return "spend";
  }
  return "even";
}
