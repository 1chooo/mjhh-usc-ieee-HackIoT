"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SpaceKind } from "../../lib/thermal";
import { cold, floor, hot, person, wall } from "./colors";
import { furnish, peopleLayout, voteAt, type Block } from "./layout";

/** Buildings drawn at most; the total still counts every room. */
const MAX_BUILDINGS = 36;
/** People drawn at most, across the open top floors. */
const MAX_PEOPLE = 24000;

const ROOMS_PER_SIDE = 8; // a floor: a corridor with up to 8 classrooms on each side
const MAX_FLOORS = 5;
const FLOOR_HEIGHT = 3.2;
const WALL_HEIGHT = 1.1; // the open top floor keeps low walls, so the rooms read from above
const WALL = 0.14;
const CORRIDOR = 3.2;
const WALK = 6; // between a building and its quad's lawn
const STREET = 14; // between quads

// USC look: red brick, cream trim and arcades, terracotta roof edges, lawns and palms.
const brick = "#a65a43";
const cream = "#ebe0c9";
const terracotta = "#b8603d";
const glass = "#3f4b56";
const lawn = "#88a75c";
const path = "#e2d5bb";
const trunk = "#8b7660";
const frond = "#4f7a3a";
// the city around campus, as on the campus map: pale blocks, white streets, grey buildings
const paving = "#d5d1c9";
const street = "#fbfaf8";
const cityGround = "#e9e8e4";
const cityBuilding = "#c8c7c3";
const otherBuilding = "#8e8c88"; // campus buildings without the system, grey as on the campus map
const RING_ROAD = 8;
const CITY_BLOCK = 34;
const CITY_REACH = 70; // how far the city goes past the ring road

export type FleetShape = {
  count: number;
  kind: SpaceKind;
  width: number;
  depth: number;
  people: number;
  hotVotes: number;
  coldVotes: number;
};

/** A top-floor room: centre, floor height, and which way it faces. */
type Spot = { x: number; y: number; z: number; yaw: number };
type Building = { x: number; z: number; yaw: number; floors: number };
type Quad = { x: number; z: number; floors: number };
type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number };

/** Turn a local (x, z) by `yaw` around the vertical axis, the way three.js turns objects. */
function turn(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

/**
 * Rooms stacked into buildings, and buildings set around quads like the USC campus: four
 * buildings (north, south, west, east) frame each lawn. A floor is a corridor with
 * classrooms on both sides; up to five floors a building. Lower floors are the brick facade;
 * the top floor is open so its rooms and people show.
 */
export function fleetLayout(count: number, width: number, depth: number) {
  const perSide = Math.min(ROOMS_PER_SIDE, Math.max(1, Math.ceil(Math.round(count) / 2)));
  const perFloor = perSide * 2;
  const perBuilding = perFloor * MAX_FLOORS;
  const shown = Math.max(1, Math.min(Math.round(count), perBuilding * MAX_BUILDINGS));
  const total = Math.ceil(shown / perBuilding);
  const bWidth = perSide * width;
  const bDepth = depth * 2 + CORRIDOR;
  const lawnSide = bWidth;
  const ring = lawnSide / 2 + WALK + bDepth / 2; // quad centre to a building's centre
  const quadSize = lawnSide + 2 * (WALK + bDepth);
  const quadCount = Math.ceil(total / 4);
  const qCols = Math.max(1, Math.ceil(Math.sqrt(quadCount)));
  const qRows = Math.ceil(quadCount / qCols);
  const spanX = qCols * (quadSize + STREET) - STREET;
  const spanZ = qRows * (quadSize + STREET) - STREET;
  // north, south, west, east of the lawn; west and east turned a quarter
  const sides: [number, number, number][] = [
    [0, -ring, 0],
    [0, ring, 0],
    [-ring, 0, Math.PI / 2],
    [ring, 0, Math.PI / 2],
  ];
  const quads: Quad[] = [];
  const buildings: Building[] = [];
  const others: Building[] = [];
  const spots: Spot[] = [];
  for (let b = 0; b < total; b++) {
    const q = Math.floor(b / 4);
    if (!quads[q]) {
      quads[q] = {
        x: (q % qCols) * (quadSize + STREET) - spanX / 2 + quadSize / 2,
        z: Math.floor(q / qCols) * (quadSize + STREET) - spanZ / 2 + quadSize / 2,
        floors: 0,
      };
    }
    const quad = quads[q]!;
    const [ox, oz, yaw] = sides[b % 4]!;
    const rooms = Math.min(perBuilding, shown - b * perBuilding);
    const floors = Math.ceil(rooms / perFloor);
    const top = rooms - (floors - 1) * perFloor;
    const x = quad.x + ox;
    const z = quad.z + oz;
    quad.floors = Math.max(quad.floors, floors);
    buildings.push({ x, z, yaw, floors });
    for (let j = 0; j < top; j++) {
      const south = j >= perSide;
      const [dx, dz] = turn(-bWidth / 2 + width / 2 + (j % perSide) * width, (south ? 1 : -1) * (CORRIDOR / 2 + depth / 2), yaw);
      // south-row rooms turned around: both rows face the corridor
      spots.push({ x: x + dx, y: (floors - 1) * FLOOR_HEIGHT, z: z + dz, yaw: yaw + (south ? Math.PI : 0) });
    }
  }
  // Fill the rest of the grid: every quad gets its lawn, and empty sides get grey buildings.
  for (let q = 0; q < qCols * qRows; q++) {
    if (!quads[q]) {
      quads[q] = {
        x: (q % qCols) * (quadSize + STREET) - spanX / 2 + quadSize / 2,
        z: Math.floor(q / qCols) * (quadSize + STREET) - spanZ / 2 + quadSize / 2,
        floors: 3,
      };
    }
    for (let side = 0; side < 4; side++) {
      if (q * 4 + side >= total) {
        const [ox, oz, yaw] = sides[side]!;
        others.push({ x: quads[q]!.x + ox, z: quads[q]!.z + oz, yaw, floors: 2 + ((q + side) % 3) });
      }
    }
  }
  const height = (Math.max(...quads.map((q) => q.floors)) + 3) * FLOOR_HEIGHT; // the bell towers stand taller
  return { spots, buildings, others, quads, perSide, bWidth, bDepth, lawnSide, spanX, spanZ, height };
}

type Part = { x: number; y: number; z: number; scale?: number; color?: string };

/** One instance per (spot, part): the parts repeat in every room, turned the way the room faces. */
function useRoomInstances(spots: Spot[], parts: Part[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let i = 0;
    for (const spot of spots) {
      for (const p of parts) {
        const [dx, dz] = turn(p.x, p.z, spot.yaw);
        dummy.position.set(spot.x + dx, spot.y + p.y, spot.z + dz);
        dummy.rotation.set(0, spot.yaw, 0);
        dummy.scale.setScalar(p.scale ?? 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (p.color) {
          mesh.setColorAt(i, tint.set(p.color));
        }
        i++;
      }
    }
    finish(mesh, i);
  }, [spots, parts]);
  return { ref, count: Math.max(1, spots.length * parts.length) };
}

/** Boxes placed, sized and turned per instance (a unit shape scaled to each size). */
function useBoxes(boxes: Box[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }
    const dummy = new THREE.Object3D();
    boxes.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.yaw ?? 0, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    finish(mesh, boxes.length);
  }, [boxes]);
  return { ref, count: Math.max(1, boxes.length) };
}

function finish(mesh: THREE.InstancedMesh, count: number) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
}

/** A box `local` to a building (x along its length, z across), placed in the world. */
function place(b: Building, x: number, y: number, z: number, sx: number, sy: number, sz: number): Box {
  const [dx, dz] = turn(x, z, b.yaw);
  return { x: b.x + dx, y, z: b.z + dz, sx, sy, sz, yaw: b.yaw };
}

/** Everything that isn't a room: brick, trim, windows, arcades, roof edges, towers, lawns, palms. */
function campusPieces(layout: ReturnType<typeof fleetLayout>, width: number) {
  const { bWidth, bDepth, perSide, lawnSide } = layout;
  const bricks: Box[] = [];
  const trims: Box[] = [];
  const windows: Box[] = [];
  const roofs: Box[] = [];
  const caps: Box[] = [];
  const lawns: Box[] = [];
  const paths: Box[] = [];
  const trunks: Box[] = [];
  const crowns: Box[] = [];
  const greys: Box[] = [];
  const grounds: Box[] = [];
  const blocks: Box[] = [];
  const streets: Box[] = [];
  const city: Box[] = [];
  for (const b of layout.buildings) {
    const lower = (b.floors - 1) * FLOOR_HEIGHT;
    const topY = lower;
    if (lower > 0) {
      bricks.push(place(b, 0, lower / 2, 0, bWidth, lower, bDepth));
    }
    for (let f = 0; f < b.floors - 1; f++) {
      // a cream string course at each floor line
      trims.push(place(b, 0, (f + 1) * FLOOR_HEIGHT - 0.15, 0, bWidth + 0.3, 0.3, bDepth + 0.3));
      for (const side of [-1, 1]) {
        for (let k = 0; k < perSide * 2; k++) {
          const x = -bWidth / 2 + (k + 0.5) * (width / 2);
          if (f === 0) {
            // ground floor: an arcade of cream piers
            trims.push(place(b, x - width / 4, 1.3, side * (bDepth / 2 + 0.25), 0.45, 2.6, 0.5));
          } else {
            windows.push(place(b, x, f * FLOOR_HEIGHT + 1.55, side * (bDepth / 2 + 0.03), 0.9, 1.7, 0.08));
          }
        }
      }
    }
    // the open top floor: a slab, and a terracotta roof edge all the way round
    trims.push(place(b, 0, topY - 0.06, 0, bWidth + 0.3, 0.12, bDepth + 0.3));
    for (const side of [-1, 1]) {
      roofs.push(place(b, 0, topY + 0.35, side * (bDepth / 2 + 0.35), bWidth + 1.4, 0.7, 0.7));
      roofs.push(place(b, side * (bWidth / 2 + 0.35), topY + 0.35, 0, 0.7, 0.7, bDepth));
    }
  }
  for (const b of layout.others) {
    const h = b.floors * FLOOR_HEIGHT;
    greys.push(place(b, 0, h / 2, 0, bWidth * 0.9, h, bDepth));
  }
  for (const q of layout.quads) {
    // the lawn with two crossing walks
    lawns.push({ x: q.x, y: 0.05, z: q.z, sx: lawnSide + 2 * WALK, sy: 0.1, sz: lawnSide + 2 * WALK });
    paths.push({ x: q.x, y: 0.15, z: q.z, sx: lawnSide + 2 * WALK, sy: 0.03, sz: 2.6 });
    paths.push({ x: q.x, y: 0.15, z: q.z, sx: 2.6, sy: 0.03, sz: lawnSide + 2 * WALK });
    // a bell tower at the head of the lawn
    const towerH = (q.floors + 3) * FLOOR_HEIGHT;
    const tz = q.z - lawnSide / 2 + 3;
    bricks.push({ x: q.x, y: towerH / 2, z: tz, sx: 4.2, sy: towerH, sz: 4.2 });
    trims.push({ x: q.x, y: towerH - 1.6, z: tz, sx: 4.6, sy: 3.2, sz: 4.6 }); // belfry
    caps.push({ x: q.x, y: towerH + 2.2, z: tz, sx: 3.6, sy: 4.4, sz: 3.6, yaw: Math.PI / 4 });
    // palms along both walks
    const reach = lawnSide / 2 + WALK - 2;
    for (const t of [-0.88, -0.64, -0.4, 0.4, 0.64, 0.88]) {
      for (const [px, pz] of [
        [t * reach, 3.4],
        [t * reach, -3.4],
        [3.4, t * reach],
        [-3.4, t * reach],
      ] as [number, number][]) {
        trunks.push({ x: q.x + px, y: 6, z: q.z + pz, sx: 0.55, sy: 12, sz: 0.55 });
        crowns.push({ x: q.x + px, y: 12.4, z: q.z + pz, sx: 5.4, sy: 1.7, sz: 5.4 });
      }
    }
  }
  // Campus paving, a ring road, and city blocks with grey buildings around it.
  const halfX = layout.spanX / 2 + 8;
  const halfZ = layout.spanZ / 2 + 8;
  const outX = halfX + RING_ROAD + CITY_REACH;
  const outZ = halfZ + RING_ROAD + CITY_REACH;
  blocks.push({ x: 0, y: -0.35, z: 0, sx: outX * 2, sy: 0.1, sz: outZ * 2 });
  grounds.push({ x: 0, y: -0.1, z: 0, sx: halfX * 2, sy: 0.1, sz: halfZ * 2 });
  for (const side of [-1, 1]) {
    streets.push({ x: 0, y: -0.22, z: side * (halfZ + RING_ROAD / 2), sx: (halfX + RING_ROAD) * 2, sy: 0.02, sz: RING_ROAD });
    streets.push({ x: side * (halfX + RING_ROAD / 2), y: -0.22, z: 0, sx: RING_ROAD, sy: 0.02, sz: (halfZ + RING_ROAD) * 2 });
  }
  const step = CITY_BLOCK + RING_ROAD;
  const seed = (i: number, j: number, k: number) => {
    const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = -Math.ceil(outX / step); i <= Math.ceil(outX / step); i++) {
    for (let j = -Math.ceil(outZ / step); j <= Math.ceil(outZ / step); j++) {
      const cx = i * step;
      const cz = j * step;
      // skip blocks that would sit on campus or the ring road
      if (Math.abs(cx) - CITY_BLOCK / 2 < halfX + RING_ROAD && Math.abs(cz) - CITY_BLOCK / 2 < halfZ + RING_ROAD) {
        continue;
      }
      streets.push({ x: cx + step / 2, y: -0.22, z: cz, sx: RING_ROAD, sy: 0.02, sz: step });
      streets.push({ x: cx, y: -0.22, z: cz + step / 2, sx: step, sy: 0.02, sz: RING_ROAD });
      // two or three plain buildings per block, different sizes and heights
      const n = 2 + Math.floor(seed(i, j, 0) * 2);
      for (let k = 0; k < n; k++) {
        const w = 8 + seed(i, j, k + 1) * 12;
        const d = 8 + seed(i, j, k + 7) * 12;
        const h = 3 + seed(i, j, k + 13) * 12;
        const ox = (seed(i, j, k + 19) - 0.5) * (CITY_BLOCK - w);
        const oz = (seed(i, j, k + 23) - 0.5) * (CITY_BLOCK - d);
        city.push({ x: cx + ox, y: h / 2, z: cz + oz, sx: w, sy: h, sz: d });
      }
    }
  }
  return { bricks, trims, windows, roofs, caps, lawns, paths, trunks, crowns, greys, grounds, blocks, streets, city };
}

/** The same room, `count` times, in red-brick buildings around lawns, seen from above at an angle. */
export function Fleet({ shape }: { shape: FleetShape }) {
  const { width, depth, kind } = shape;
  const layout = useMemo(() => fleetLayout(shape.count, width, depth), [shape.count, width, depth]);
  const blocks = useMemo(() => furnish(kind, width, depth), [kind, width, depth]);
  const pieces = useMemo(() => campusPieces(layout, width), [layout, width]);

  const crowd = useMemo(() => {
    const drawn = layout.spots.length * Math.round(shape.people) <= MAX_PEOPLE;
    const { spots, scale } = peopleLayout(drawn ? shape.people : 0, width, depth);
    const colors = { hot, cold, none: person };
    const color = (i: number) => colors[voteAt(i, shape.hotVotes, shape.coldVotes)];
    return {
      bodies: spots.map(([x, z], i) => ({ x, y: 0.32 * scale, z, scale, color: color(i) })),
      heads: spots.map(([x, z], i) => ({ x, y: 0.72 * scale, z, scale, color: color(i) })),
    };
  }, [layout.spots.length, shape.people, shape.hotVotes, shape.coldVotes, width, depth]);
  const floors = useMemo(() => [{ x: 0, y: 0.08, z: 0 }], []);
  const longWalls = useMemo(() => [-1, 1].map((side) => ({ x: 0, y: WALL_HEIGHT / 2, z: (side * depth) / 2 })), [depth]);
  const shortWalls = useMemo(() => [-1, 1].map((side) => ({ x: (side * width) / 2, y: WALL_HEIGHT / 2, z: 0 })), [width]);

  const meshes = {
    bricks: useBoxes(pieces.bricks),
    trims: useBoxes(pieces.trims),
    windows: useBoxes(pieces.windows),
    roofs: useBoxes(pieces.roofs),
    caps: useBoxes(pieces.caps),
    lawns: useBoxes(pieces.lawns),
    paths: useBoxes(pieces.paths),
    trunks: useBoxes(pieces.trunks),
    crowns: useBoxes(pieces.crowns),
    greys: useBoxes(pieces.greys),
    grounds: useBoxes(pieces.grounds),
    blocks: useBoxes(pieces.blocks),
    streets: useBoxes(pieces.streets),
    city: useBoxes(pieces.city),
  };
  const floorMesh = useRoomInstances(layout.spots, floors);
  const longMesh = useRoomInstances(layout.spots, longWalls);
  const shortMesh = useRoomInstances(layout.spots, shortWalls);
  const bodyMesh = useRoomInstances(layout.spots, crowd.bodies);
  const headMesh = useRoomInstances(layout.spots, crowd.heads);
  // New buffers whenever the number of instances changes.
  const key = `${layout.spots.length}:${layout.buildings.length}:${pieces.trims.length}:${pieces.windows.length}:${pieces.city.length}:${pieces.streets.length}:${pieces.greys.length}:${width}:${depth}:${crowd.bodies.length}`;

  const solid = (name: keyof typeof meshes, color: string, geometry: "box" | "cone" | "sphere" | "cylinder", shadow = true) =>
    pieces[name].length ? (
      <instancedMesh
        key={`${name}${key}`}
        ref={meshes[name].ref}
        args={[undefined, undefined, meshes[name].count]}
        castShadow={shadow}
        receiveShadow
      >
        {geometry === "cone" ? (
          <coneGeometry args={[0.5, 1, 4]} />
        ) : geometry === "sphere" ? (
          <sphereGeometry args={[0.5, 8, 5]} />
        ) : geometry === "cylinder" ? (
          <cylinderGeometry args={[0.4, 0.5, 1, 6]} />
        ) : (
          <boxGeometry />
        )}
        <meshStandardMaterial color={color} roughness={name === "windows" ? 0.35 : 0.85} />
      </instancedMesh>
    ) : null;

  return (
    <group>
      {solid("blocks", cityGround, "box", false)}
      {solid("grounds", paving, "box", false)}
      {solid("streets", street, "box", false)}
      {solid("city", cityBuilding, "box")}
      {solid("greys", otherBuilding, "box")}
      {solid("lawns", lawn, "box", false)}
      {solid("paths", path, "box", false)}
      {solid("bricks", brick, "box")}
      {solid("trims", cream, "box", false)}
      {solid("windows", glass, "box", false)}
      {solid("roofs", terracotta, "box", false)}
      {solid("caps", terracotta, "cone")}
      {solid("trunks", trunk, "cylinder", false)}
      {solid("crowns", frond, "sphere", false)}
      <instancedMesh key={`f${key}`} ref={floorMesh.ref} args={[undefined, undefined, floorMesh.count]} receiveShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color={floor} />
      </instancedMesh>
      <instancedMesh key={`l${key}`} ref={longMesh.ref} args={[undefined, undefined, longMesh.count]}>
        <boxGeometry args={[width + WALL, WALL_HEIGHT, WALL]} />
        <meshStandardMaterial color={wall} />
      </instancedMesh>
      <instancedMesh key={`e${key}`} ref={shortMesh.ref} args={[undefined, undefined, shortMesh.count]}>
        <boxGeometry args={[WALL, WALL_HEIGHT, depth]} />
        <meshStandardMaterial color={wall} />
      </instancedMesh>
      {blocks.map((block, i) => (
        <Furniture key={`b${i}${key}`} block={block} spots={layout.spots} />
      ))}
      {crowd.bodies.length ? (
        <>
          <instancedMesh key={`p${key}`} ref={bodyMesh.ref} args={[undefined, undefined, bodyMesh.count]}>
            <capsuleGeometry args={[0.15, 0.34, 1, 5]} />
            <meshStandardMaterial roughness={0.62} />
          </instancedMesh>
          <instancedMesh key={`h${key}`} ref={headMesh.ref} args={[undefined, undefined, headMesh.count]}>
            <sphereGeometry args={[0.12, 6, 4]} />
            <meshStandardMaterial roughness={0.62} />
          </instancedMesh>
        </>
      ) : null}
    </group>
  );
}

function Furniture({ block, spots }: { block: Block; spots: Spot[] }) {
  const parts = useMemo(() => [{ x: block.position[0], y: block.position[1], z: block.position[2] }], [block]);
  const mesh = useRoomInstances(spots, parts);
  return (
    <instancedMesh ref={mesh.ref} args={[undefined, undefined, mesh.count]}>
      <boxGeometry args={block.size} />
      <meshStandardMaterial color={block.color} />
    </instancedMesh>
  );
}
