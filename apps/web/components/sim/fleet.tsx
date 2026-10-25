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

const ROOMS_PER_SIDE = 6; // a floor: a corridor with up to 6 classrooms on each side
/** Floors each building may have (two to five), in turn, so low and tall buildings stand side by side. */
const FLOOR_PLAN = [5, 3, 4, 2, 5, 4, 3];
const FLOOR_HEIGHT = 3.2;
const WALL_HEIGHT = 1.1; // the open top floor keeps low walls, so the rooms read from above
const WALL = 0.14;
const CORRIDOR = 3.2;
const SLAB = 0.15; // the open top floor's slab; its rooms stand on it, clear of the facade below
const STREET = 14; // between quads
const PLAZA = 12; // a lone small building gets a plaza in front instead of a quad
const MIN_COURT = 16; // a courtyard narrower than this is no lawn: build the small layout instead

// USC look: brick or stone, cream trim and arcades, terracotta roof edges, lawns and palms.
// Four building styles so a big campus isn't one building copied; each building gets one.
type Style = { wall: string; trim: string; roof: string; glass: string; arcade: boolean; band: boolean; feature: "pavilion" | "turrets" | "none" };
const STYLES: Style[] = [
  { wall: "#a65a43", trim: "#ebe0c9", roof: "#b8603d", glass: "#3f4b56", arcade: true, band: false, feature: "pavilion" }, // red brick
  { wall: "#cbb08b", trim: "#f2e8d3", roof: "#b8603d", glass: "#4a4f55", arcade: true, band: false, feature: "turrets" }, // sandstone
  { wall: "#80402f", trim: "#e3d5bb", roof: "#5d6168", glass: "#2f3a44", arcade: false, band: false, feature: "turrets" }, // dark brick, slate
  { wall: "#cfccc5", trim: "#9aa3a8", roof: "#7c8288", glass: "#5f7d91", arcade: false, band: true, feature: "none" }, // modern concrete and glass
];
const towerBrick = "#a65a43";
const towerTrim = "#ebe0c9";
const towerCap = "#b8603d";
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
type Building = { x: number; z: number; yaw: number; floors: number; style: number };
/** Open ground with a tower and palms: a quad's courtyard, or the plaza in front of a lone building. */
type Green = { x: number; z: number; floors: number; halfX: number; halfZ: number; towerX: number; towerZ: number; plaza: boolean };
type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; color?: string };

/** Turn a local (x, z) by `yaw` around the vertical axis, the way three.js turns objects. */
function turn(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

/**
 * Rooms stacked into buildings. A floor is a corridor with classrooms on both sides; up to
 * five floors a building. Four buildings close a quad around a courtyard lawn, their corners
 * touching, like the USC quads; a handful of rooms is one building with a plaza in front.
 * Lower floors are the facade; the top floor is open so its rooms and people show.
 */
export function fleetLayout(count: number, width: number, depth: number) {
  const perSide = Math.min(ROOMS_PER_SIDE, Math.max(1, Math.ceil(Math.round(count) / 2)));
  const perFloor = perSide * 2;
  // rooms in each building: floors from FLOOR_PLAN, the last building takes what is left
  const target = Math.max(1, Math.round(count));
  const sizes: number[] = [];
  for (let left = target; left > 0 && sizes.length < MAX_BUILDINGS; ) {
    const rooms = Math.min(left, perFloor * FLOOR_PLAN[sizes.length % FLOOR_PLAN.length]!);
    sizes.push(rooms);
    left -= rooms;
  }
  const total = sizes.length;
  const bWidth = perSide * width;
  const bDepth = depth * 2 + CORRIDOR;
  const courtX = bWidth / 2 - bDepth; // courtyard half-width between the west and east wings
  const courtyard = courtX * 2 >= MIN_COURT;
  const buildings: Building[] = [];
  const others: Building[] = [];
  const greens: Green[] = [];
  const spots: Spot[] = [];
  const addRooms = (x: number, z: number, yaw: number, rooms: number, style: number) => {
    const floors = Math.ceil(rooms / perFloor);
    const top = rooms - (floors - 1) * perFloor;
    buildings.push({ x, z, yaw, floors, style });
    for (let j = 0; j < top; j++) {
      const south = j >= perSide;
      const [dx, dz] = turn(-bWidth / 2 + width / 2 + (j % perSide) * width, (south ? 1 : -1) * (CORRIDOR / 2 + depth / 2), yaw);
      // south-row rooms turned around: both rows face the corridor
      spots.push({ x: x + dx, y: (floors - 1) * FLOOR_HEIGHT + SLAB, z: z + dz, yaw: yaw + (south ? Math.PI : 0) });
    }
    return floors;
  };
  let spanX: number;
  let spanZ: number;
  if (!courtyard) {
    // One small building, a plaza in front with a few palms, a tower at its end.
    spanX = Math.max(bWidth + 8, 24);
    spanZ = bDepth + 1 + PLAZA;
    const bz = -spanZ / 2 + bDepth / 2;
    const floors = addRooms(0, bz, 0, sizes[0]!, 0);
    greens.push({ x: 0, z: bz + bDepth / 2 + 1 + PLAZA / 2, floors, halfX: spanX / 2, halfZ: PLAZA / 2, towerX: bWidth / 2 + 2.5, towerZ: bz, plaza: true });
  } else {
    const quadW = bWidth;
    const quadD = bWidth + 2 * bDepth;
    const quadCount = Math.ceil(total / 4);
    // a near-square grid with as few empty slots as possible (an empty slot is a grey quad)
    const qRows = Math.min(quadCount, Math.max(1, Math.round(Math.sqrt((quadCount * quadW) / quadD))));
    const qCols = Math.ceil(quadCount / qRows);
    spanX = qCols * (quadW + STREET) - STREET;
    spanZ = qRows * (quadD + STREET) - STREET;
    // north, south, west, east; the west and east wings fit between the ends of the other two
    const sides: [number, number, number][] = [
      [0, -(bWidth / 2 + bDepth / 2), 0],
      [0, bWidth / 2 + bDepth / 2, 0],
      [-(bWidth / 2 - bDepth / 2), 0, Math.PI / 2],
      [bWidth / 2 - bDepth / 2, 0, Math.PI / 2],
    ];
    for (let q = 0; q < qCols * qRows; q++) {
      const qx = (q % qCols) * (quadW + STREET) - spanX / 2 + quadW / 2;
      const qz = Math.floor(q / qCols) * (quadD + STREET) - spanZ / 2 + quadD / 2;
      let floors = 0;
      for (let side = 0; side < 4; side++) {
        const b = q * 4 + side;
        const [ox, oz, yaw] = sides[side]!;
        if (b < total) {
          floors = Math.max(floors, addRooms(qx + ox, qz + oz, yaw, sizes[b]!, (b + q) % STYLES.length));
        } else {
          // sides with no classrooms of ours: other campus buildings, grey as on the campus map
          others.push({ x: qx + ox, z: qz + oz, yaw, floors: 2 + ((q + side) % 3), style: 0 });
        }
      }
      greens.push({ x: qx, z: qz, floors: floors || 3, halfX: courtX, halfZ: bWidth / 2, towerX: qx, towerZ: qz - bWidth / 2 + 2.6, plaza: false });
    }
  }
  const height = (Math.max(...greens.map((g) => g.floors)) + 3) * FLOOR_HEIGHT; // the bell towers stand taller
  return { spots, buildings, others, greens, perSide, bWidth, bDepth, spanX, spanZ, height };
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
    const tint = new THREE.Color();
    boxes.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.yaw ?? 0, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (b.color) {
        mesh.setColorAt(i, tint.set(b.color));
      }
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
function place(b: Building, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: string): Box {
  const [dx, dz] = turn(x, z, b.yaw);
  return { x: b.x + dx, y, z: b.z + dz, sx, sy, sz, yaw: b.yaw, color };
}

/** Everything that isn't a room: facades, trim, windows, roof edges, towers, lawns, palms. */
function campusPieces(layout: ReturnType<typeof fleetLayout>, width: number) {
  const { bWidth, bDepth, perSide } = layout;
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
    const st = STYLES[b.style]!;
    const lower = (b.floors - 1) * FLOOR_HEIGHT;
    if (lower > 0) {
      bricks.push(place(b, 0, lower / 2, 0, bWidth, lower, bDepth, st.wall));
    }
    for (let f = 0; f < b.floors - 1; f++) {
      if (f < b.floors - 2) {
        // a string course at each floor line (the slab is the top one)
        trims.push(place(b, 0, (f + 1) * FLOOR_HEIGHT - 0.15, 0, bWidth + 0.3, 0.3, bDepth + 0.3, st.trim));
      }
      for (const side of [-1, 1]) {
        if (st.band && f > 0) {
          // modern: one glass band per floor
          windows.push(place(b, 0, f * FLOOR_HEIGHT + 1.5, side * (bDepth / 2 + 0.03), bWidth * 0.96, 1.9, 0.08, st.glass));
          continue;
        }
        for (let k = 0; k < perSide * 2; k++) {
          const x = -bWidth / 2 + (k + 0.5) * (width / 2);
          if (f === 0 && st.arcade) {
            // ground floor: an arcade of cream piers
            trims.push(place(b, x - width / 4, 1.3, side * (bDepth / 2 + 0.25), 0.45, 2.6, 0.5, st.trim));
          } else {
            windows.push(place(b, x, f * FLOOR_HEIGHT + 1.55, side * (bDepth / 2 + 0.03), 0.9, 1.7, 0.08, st.glass));
          }
        }
      }
    }
    // the open top floor: a slab the rooms stand on, and a roof edge all the way round
    trims.push(place(b, 0, lower + SLAB / 2, 0, bWidth + 0.3, SLAB, bDepth + 0.3, st.trim));
    const edgeY = lower + SLAB + 0.35;
    for (const side of [-1, 1]) {
      roofs.push(place(b, 0, edgeY, side * (bDepth / 2 + 0.35), bWidth + 1.4, 0.7, 0.7, st.roof));
      roofs.push(place(b, side * (bWidth / 2 + 0.35), edgeY, 0, 0.7, 0.7, bDepth, st.roof));
    }
    if (st.feature === "pavilion" && b.floors > 1) {
      // an entrance pavilion in the middle of each long side, with a hipped roof
      for (const side of [-1, 1]) {
        const z = side * (bDepth / 2 + 0.7);
        bricks.push(place(b, 0, (lower + 1.4) / 2, z, width * 1.6, lower + 1.4, 1.4, st.wall));
        trims.push(place(b, 0, 1.3, side * (bDepth / 2 + 1.45), width * 0.7, 2.6, 0.12, st.trim)); // the doorway
        roofs.push(place(b, 0, lower + 1.65, z, width * 1.8, 0.5, 1.9, st.roof));
      }
    }
    if (st.feature === "turrets") {
      // a turret on each corner, a floor taller than the building
      const h = lower + FLOOR_HEIGHT + 1.2;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = sx * (bWidth / 2 + 0.6);
          const z = sz * (bDepth / 2 + 0.6);
          bricks.push(place(b, x, h / 2, z, 2.6, h, 2.6, st.wall));
          caps.push({ ...place(b, x, h + 1.2, z, 3.2, 2.4, 3.2), yaw: b.yaw + Math.PI / 4, color: st.roof });
        }
      }
    }
  }
  for (const b of layout.others) {
    const h = b.floors * FLOOR_HEIGHT;
    greys.push(place(b, 0, h / 2, 0, bWidth * 0.94, h, bDepth));
  }
  for (const g of layout.greens) {
    // the lawn with crossing walks (one walk along a plaza)
    lawns.push({ x: g.x, y: 0.05, z: g.z, sx: g.halfX * 2, sy: 0.1, sz: g.halfZ * 2 });
    paths.push({ x: g.x, y: 0.15, z: g.z, sx: g.halfX * 2, sy: 0.03, sz: 2.6 });
    if (!g.plaza) {
      paths.push({ x: g.x, y: 0.15, z: g.z, sx: 2.6, sy: 0.03, sz: g.halfZ * 2 });
    }
    // a bell tower; smaller beside a lone small building
    const s = g.plaza ? 0.7 : 1;
    const towerH = (g.floors + (g.plaza ? 2 : 3)) * FLOOR_HEIGHT;
    bricks.push({ x: g.towerX, y: towerH / 2, z: g.towerZ, sx: 4.2 * s, sy: towerH, sz: 4.2 * s, color: towerBrick });
    trims.push({ x: g.towerX, y: towerH - 1.6, z: g.towerZ, sx: 4.6 * s, sy: 3.2, sz: 4.6 * s, color: towerTrim }); // belfry
    caps.push({ x: g.towerX, y: towerH + 2.2, z: g.towerZ, sx: 3.6 * s, sy: 4.4, sz: 3.6 * s, yaw: Math.PI / 4, color: towerCap });
    // palms along the walks, spaced and sized to the lawn so they never crowd the buildings
    const p = Math.min(1, Math.max(0.45, Math.min(g.halfX, g.halfZ) / 20));
    const off = 3.4 * p;
    const palm = (x: number, z: number) => {
      trunks.push({ x, y: 6 * p, z, sx: 0.55 * p, sy: 12 * p, sz: 0.55 * p });
      crowns.push({ x, y: 12.4 * p, z, sx: 5.4 * p, sy: 1.7 * p, sz: 5.4 * p });
    };
    const along = (half: number) => {
      const out: number[] = [];
      for (let t = 6 * p; t < half - 3 * p; t += 10 * p) out.push(t, -t);
      return out;
    };
    for (const t of along(g.halfX)) {
      palm(g.x + t, g.z + off);
      if (!g.plaza) palm(g.x + t, g.z - off);
    }
    if (!g.plaza) {
      for (const t of along(g.halfZ)) {
        palm(g.x + off, g.z + t);
        palm(g.x - off, g.z + t);
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

/** The same room, `count` times, in campus buildings around lawns, seen from above at an angle. */
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
  const key = `${layout.spots.length}:${layout.buildings.length}:${pieces.bricks.length}:${pieces.caps.length}:${pieces.trunks.length}:${pieces.lawns.length}:${pieces.paths.length}:${pieces.roofs.length}:${pieces.trims.length}:${pieces.windows.length}:${pieces.city.length}:${pieces.streets.length}:${pieces.greys.length}:${width}:${depth}:${crowd.bodies.length}`;

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
      {solid("bricks", "#ffffff", "box")}
      {solid("trims", "#ffffff", "box", false)}
      {solid("windows", "#ffffff", "box", false)}
      {solid("roofs", "#ffffff", "box", false)}
      {solid("caps", "#ffffff", "cone")}
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
