import type { SpaceKind } from "../../lib/thermal";
import { desk, shelf, table } from "./colors";

export type Block = {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
};

export function voteAt(
  index: number,
  hotVotes: number,
  coldVotes: number,
): "hot" | "cold" | "none" {
  const hot = Math.max(0, Math.round(hotVotes));
  const cold = Math.max(0, Math.round(coldVotes));
  if (index < hot) {
    return "hot";
  }
  if (index < hot + cold) {
    return "cold";
  }
  return "none";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roomFootprint(area: number, kind: SpaceKind): {
  width: number;
  depth: number;
  height: number;
} {
  const span = Math.sqrt(Math.max(area, 40));
  const wide = kind === "library";
  return {
    width: clamp(span * (wide ? 0.62 : 0.52), 12, 26),
    depth: clamp(span * (wide ? 0.42 : 0.46), 9, 18),
    height: 2.55,
  };
}

export function furnish(kind: SpaceKind, width: number, depth: number): Block[] {
  if (kind === "library") {
    return libraryFurniture(width, depth);
  }
  return classroomFurniture(width, depth);
}

function libraryFurniture(width: number, depth: number): Block[] {
  const blocks: Block[] = [];
  const shelfCount = Math.max(3, Math.round(width / 2.6));
  const span = width - 2.8;
  for (let index = 0; index < shelfCount; index += 1) {
    const x =
      shelfCount === 1 ? 0 : -span / 2 + (index / (shelfCount - 1)) * span;
    blocks.push({
      position: [x, 0.9, -depth / 2 + 0.8],
      size: [0.9, 1.8, 0.36],
      color: shelf,
    });
  }
  blocks.push({
    position: [width / 2 - 0.85, 0.74, 0],
    size: [0.9, 0.07, Math.min(3.2, depth * 0.45)],
    color: table,
  });
  return blocks;
}

function classroomFurniture(width: number, depth: number): Block[] {
  const blocks: Block[] = [
    {
      position: [0, 1.35, depth / 2 - 0.28],
      size: [Math.min(3.4, width * 0.4), 0.7, 0.08],
      color: desk,
    },
  ];
  const rows = 4;
  const x = width / 2 - 0.7;
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row += 1) {
      const z = -depth * 0.28 + row * 0.95;
      blocks.push({
        position: [side * x, 0.74, z],
        size: [0.7, 0.06, 0.48],
        color: desk,
      });
    }
  }
  return blocks;
}

export function peopleLayout(
  count: number,
  width: number,
  depth: number,
): { spots: [number, number][]; scale: number } {
  const people = Math.max(0, Math.round(count));
  if (people === 0) {
    return { spots: [], scale: 1 };
  }
  const marginX = 2.15;
  const marginZ = 2.05;
  const usableW = Math.max(1.2, width - marginX * 2);
  const usableD = Math.max(1.2, depth - marginZ * 2);
  const cols = Math.max(1, Math.ceil(Math.sqrt(people * (usableW / usableD))));
  const rows = Math.ceil(people / cols);
  const gapX = cols === 1 ? usableW : usableW / Math.max(1, cols - 1);
  const gapZ = rows === 1 ? usableD : usableD / Math.max(1, rows - 1);
  const spots: [number, number][] = [];
  for (let index = 0; index < people; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = cols === 1 ? 0 : -usableW / 2 + col * gapX;
    const z = rows === 1 ? 0 : -usableD / 2 + row * gapZ;
    spots.push([x, z]);
  }
  return {
    spots,
    scale: clamp(Math.min(gapX, gapZ) / 0.9, 0.38, 1),
  };
}
