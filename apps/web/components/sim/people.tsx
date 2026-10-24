"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Scenario } from "../../lib/thermal";
import { cold, hot, ink, person } from "./colors";
import { peopleLayout, voteAt } from "./layout";
import type { SimPick } from "./sim-types";

const voteColor = {
  hot,
  cold,
  none: person,
} as const;

export function People({
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
  onSelect: (pick: SimPick | null) => void;
}) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.15, 0.34, 4, 8), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.12, 12, 10), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.62 }),
    [],
  );
  const layout = useMemo(
    () => peopleLayout(scenario.occupancy, width, depth),
    [scenario.occupancy, width, depth],
  );

  useLayoutEffect(() => {
    const bodies = body.current;
    const heads = head.current;
    if (!bodies || !heads) {
      return;
    }
    layout.spots.forEach(([x, z], index) => {
      const vote = voteAt(index, scenario.hotVotes, scenario.coldVotes);
      color.set(voteColor[vote]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(layout.scale);
      dummy.position.set(x, 0.32 * layout.scale, z);
      dummy.updateMatrix();
      bodies.setMatrixAt(index, dummy.matrix);
      bodies.setColorAt(index, color);
      dummy.position.set(x, 0.72 * layout.scale, z);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
      heads.setColorAt(index, color);
    });
    bodies.count = layout.spots.length;
    heads.count = layout.spots.length;
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) {
      bodies.instanceColor.needsUpdate = true;
    }
    if (heads.instanceColor) {
      heads.instanceColor.needsUpdate = true;
    }
  }, [color, dummy, layout, scenario.coldVotes, scenario.hotVotes]);

  if (layout.spots.length === 0) {
    return null;
  }

  function onPerson(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    const index = event.instanceId;
    if (index === undefined) {
      return;
    }
    onSelect({ type: "person", index });
  }

  const selectedIndex = selected?.type === "person" ? selected.index : null;
  const selectedSpot =
    selectedIndex !== null ? layout.spots[selectedIndex] : undefined;

  return (
    <group>
      <instancedMesh
        ref={body}
        args={[bodyGeo, material, 200]}
        castShadow
        frustumCulled={false}
        onClick={onPerson}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      />
      <instancedMesh
        ref={head}
        args={[headGeo, material, 200]}
        castShadow
        frustumCulled={false}
        onClick={onPerson}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      />
      {selectedSpot ? (
        <mesh
          position={[selectedSpot[0], 0.03, selectedSpot[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.22 * layout.scale, 0.32 * layout.scale, 24]} />
          <meshBasicMaterial color={ink} />
        </mesh>
      ) : null}
    </group>
  );
}
