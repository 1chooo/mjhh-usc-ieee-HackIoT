import type { Reading } from "../../lib/campus";
import type { Scenario, ThermalResult } from "../../lib/thermal";
import type { PersonVote } from "./layout";

export type SimMode = "room" | "campus";

export type SensorKind = "temperature" | "humidity" | "occupancy" | "outdoor";

export type SimPick =
  | { type: "person"; index: number }
  | { type: "sensor"; sensor: SensorKind };

export type SimCanvasProps = {
  mode: SimMode;
  scenario: Scenario;
  result: ThermalResult;
  readings: Record<string, Reading>;
  votes: PersonVote[] | null;
  selected: SimPick | null;
  onSelect: (pick: SimPick | null) => void;
  onSelectSpace: (spaceId: string) => void;
};
