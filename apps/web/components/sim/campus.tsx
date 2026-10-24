"use client";

import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { evaluateSpace, spaces, type Reading, type Space } from "../../lib/campus";
import { actionColor, floor, outdoorTint, wall } from "./colors";
import { FloatLabel } from "./float-label";

export function Campus({
  readings,
  onSelectSpace,
}: {
  readings: Record<string, Reading>;
  onSelectSpace: (spaceId: string) => void;
}) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={floor} />
      </mesh>
      {spaces.map((space, index) => {
        const reading = readings[space.id];
        if (!reading) {
          return null;
        }
        return (
          <Building
            key={space.id}
            space={space}
            reading={reading}
            index={index}
            total={spaces.length}
            onSelect={() => onSelectSpace(space.id)}
          />
        );
      })}
    </group>
  );
}

function spotFor(index: number, total: number): [number, number, number] {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const rows = Math.ceil(total / 2);
  const x = column === 0 ? -16 : 16;
  const z = (row - (rows - 1) / 2) * 18;
  return [x, 0, z];
}

function Building({
  space,
  reading,
  index,
  total,
  onSelect,
}: {
  space: Space;
  reading: Reading;
  index: number;
  total: number;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const result = evaluateSpace(space, reading);
  const span = Math.min(9.5, Math.max(5.2, Math.sqrt(space.floorAreaM2) * 0.34));
  const height = space.kind === "library" ? 4.6 : 3.3;
  const depth = span * 0.72;
  const glow = actionColor(result.action);

  function onClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect();
  }

  function onPointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
    setHovered(true);
  }

  function onPointerOut() {
    document.body.style.cursor = "";
    setHovered(false);
  }

  const pick = { onClick, onPointerOver, onPointerOut };

  return (
    <group position={spotFor(index, total)} {...pick}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[span, height, depth]} />
        <meshStandardMaterial
          color={reading.scheduledOpen ? wall : "#e4ddd2"}
          emissive={hovered ? glow : "#000000"}
          emissiveIntensity={hovered ? 0.18 : 0}
        />
      </mesh>
      <mesh position={[0, height + 0.08, 0]} castShadow>
        <boxGeometry args={[span + 0.2, 0.16, depth + 0.2]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, height * 0.58, depth / 2 + 0.02]}>
        <planeGeometry args={[span * 0.46, height * 0.22]} />
        <meshStandardMaterial color={outdoorTint(reading.outdoorC)} />
      </mesh>
      <FloatLabel
        value={space.name}
        position={[0, height + 1.15, 0]}
        scale={1.8}
      />
    </group>
  );
}
