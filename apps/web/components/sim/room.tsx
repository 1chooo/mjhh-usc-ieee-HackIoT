"use client";

import type { Scenario, ThermalResult } from "../../lib/thermal";
import { actionColor, floor, ink, outdoorTint, wall } from "./colors";
import { FloatLabel } from "./float-label";
import { furnish, roomFootprint, type PersonVote } from "./layout";
import { People } from "./people";
import { bindPick } from "./pick";
import type { SensorKind, SimPick } from "./sim-types";
import { toF } from "../../lib/units";

export function Room({
  scenario,
  result,
  votes,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  result: ThermalResult;
  votes: PersonVote[] | null;
  selected: SimPick | null;
  onSelect: (pick: SimPick | null) => void;
}) {
  const { width, depth, height } = roomFootprint(
    scenario.floorAreaM2,
    scenario.kind,
  );
  const blocks = furnish(scenario.kind, width, depth);
  const tint = outdoorTint(scenario.outdoorC);
  const glow = actionColor(result.action);

  return (
    <group>
      <Floor width={width} depth={depth} onClear={() => onSelect(null)} />
      <Walls
        width={width}
        depth={depth}
        height={height}
        tint={tint}
      />
      {blocks.map((block, index) => (
        <mesh key={index} position={block.position} castShadow receiveShadow>
          <boxGeometry args={block.size} />
          <meshStandardMaterial color={block.color} />
        </mesh>
      ))}
      <People
        scenario={scenario}
        votes={votes}
        width={width}
        depth={depth}
        selected={selected}
        onSelect={onSelect}
      />
      <Sensors
        scenario={scenario}
        width={width}
        depth={depth}
        selected={selected}
        onSelect={onSelect}
      />
      <mesh position={[0, height - 0.08, 0]} castShadow>
        <boxGeometry args={[1.7, 0.12, 1.7]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={result.action === "hold" ? 0.18 : 0.85}
        />
      </mesh>
      {scenario.scheduledOpen ? null : (
        <FloatLabel value="Closed" position={[0, 1.45, 0]} tone="dark" />
      )}
    </group>
  );
}

function Floor({
  width,
  depth,
  onClear,
}: {
  width: number;
  depth: number;
  onClear: () => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={floor} />
    </mesh>
  );
}

function Walls({
  width,
  depth,
  height,
  tint,
}: {
  width: number;
  depth: number;
  height: number;
  tint: string;
}) {
  const thickness = 0.14;
  const halfW = width / 2;
  const halfD = depth / 2;
  const windowWidth = Math.min(width * 0.58, width - 1.4);
  const windowHeight = 1.15;
  const sill = 0.95;
  const pier = (width - windowWidth) / 2;
  const doorWidth = 0.95;
  const doorHeight = 1.95;
  const sideLength = (depth - doorWidth) / 2;

  return (
    <group>
      <mesh position={[0, height / 2, -halfD]} castShadow receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[halfW, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[thickness, height, depth]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh
        position={[-halfW, height / 2, -(doorWidth + sideLength) / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[thickness, height, sideLength]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh
        position={[-halfW, height / 2, (doorWidth + sideLength) / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[thickness, height, sideLength]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh
        position={[-halfW, doorHeight + (height - doorHeight) / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[thickness, height - doorHeight, doorWidth]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[-halfW + 0.08, doorHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.06, doorHeight, doorWidth - 0.08]} />
        <meshStandardMaterial color={ink} />
      </mesh>
      <mesh position={[-halfW + pier / 2, height / 2, halfD]} castShadow receiveShadow>
        <boxGeometry args={[pier, height, thickness]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[halfW - pier / 2, height / 2, halfD]} castShadow receiveShadow>
        <boxGeometry args={[pier, height, thickness]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh
        position={[0, sill / 2, halfD]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[windowWidth, sill, thickness]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh
        position={[0, sill + windowHeight + (height - sill - windowHeight) / 2, halfD]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[windowWidth, height - sill - windowHeight, thickness]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[0, sill + windowHeight / 2, halfD - 0.02]}>
        <planeGeometry args={[windowWidth - 0.08, windowHeight - 0.08]} />
        <meshStandardMaterial color={tint} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Sensors({
  scenario,
  width,
  depth,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  width: number;
  depth: number;
  selected: SimPick | null;
  onSelect: (pick: SimPick) => void;
}) {
  const sensors: {
    kind: SensorKind;
    value: string;
    position: [number, number, number];
  }[] = [
    {
      kind: "temperature",
      value: `${toF(scenario.indoorC).toFixed(1)}°`,
      position: [-width / 2 + 0.28, 1.5, depth * 0.12],
    },
    {
      kind: "humidity",
      value: `${Math.round(scenario.humidityPct)}%`,
      position: [width / 2 - 0.28, 1.5, -depth * 0.08],
    },
    {
      kind: "occupancy",
      value: String(Math.round(scenario.occupancy)),
      position: [width * 0.16, 1.55, -depth / 2 + 0.28],
    },
    {
      kind: "outdoor",
      value: `${toF(scenario.outdoorC).toFixed(1)}°`,
      position: [width * 0.2, 1.6, depth / 2 - 0.28],
    },
  ];

  return (
    <group>
      {sensors.map((sensor) => {
        const active =
          selected?.type === "sensor" && selected.sensor === sensor.kind;
        return (
          <group key={sensor.kind} position={sensor.position}>
            <mesh castShadow {...bindPick(() => onSelect({ type: "sensor", sensor: sensor.kind }))}>
              <boxGeometry args={[0.28, 0.38, 0.08]} />
              <meshStandardMaterial
                color={active ? ink : "#ffffff"}
                emissive={active ? ink : "#000000"}
                emissiveIntensity={active ? 0.25 : 0}
              />
            </mesh>
            <FloatLabel value={sensor.value} position={[0, 0.55, 0]} scale={0.85} />
          </group>
        );
      })}
    </group>
  );
}
