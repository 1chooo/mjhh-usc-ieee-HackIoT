"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Campus } from "./campus";
import { paper, gridLine } from "./colors";
import { roomFootprint } from "./layout";
import { Room } from "./room";
import type { SimCanvasProps, SimMode } from "./sim-types";

export function SimCanvas({
  mode,
  scenario,
  result,
  readings,
  votes,
  selected,
  onSelect,
  onSelectSpace,
}: SimCanvasProps) {
  const room = roomFootprint(scenario.floorAreaM2, scenario.kind);
  const open = mode === "campus" || scenario.scheduledOpen;
  const target = useMemo<[number, number, number]>(
    () => (mode === "room" ? [0, 0.4, 0] : [0, 0, 0]),
    [mode],
  );

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [16, 10, 18], fov: 42, near: 0.1, far: 220 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[paper]} />
      <fog
        attach="fog"
        args={[paper, mode === "room" ? 36 : 80, mode === "room" ? 120 : 360]}
      />
      <ambientLight intensity={open ? 0.82 : 0.32} />
      <hemisphereLight args={["#f7f4ef", "#e4ddd2", open ? 0.42 : 0.14]} />
      <directionalLight
        position={[18, 28, 14]}
        intensity={open ? 1.15 : 0.42}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Grid
        position={[0, 0.005, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={gridLine}
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#cfc8bd"
        fadeDistance={70}
        infiniteGrid
      />
      {mode === "room" ? (
        <Room
          scenario={scenario}
          result={result}
          votes={votes}
          selected={selected}
          onSelect={onSelect}
        />
      ) : (
        <Campus readings={readings} onSelectSpace={onSelectSpace} />
      )}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.28}
        scale={mode === "room" ? 28 : 70}
        blur={2.2}
        far={8}
        color="#1f1c18"
      />
      <OrbitControls
        makeDefault
        enablePan
        maxPolarAngle={Math.PI / 2.08}
        minDistance={mode === "room" ? 4 : 14}
        maxDistance={mode === "room" ? 42 : 90}
        target={target}
      />
      <CameraFrame mode={mode} width={room.width} depth={room.depth} />
    </Canvas>
  );
}

function CameraFrame({
  mode,
  width,
  depth,
}: {
  mode: SimMode;
  width: number;
  depth: number;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const seen = useRef<string | null>(null);

  useLayoutEffect(() => {
    const token = `${mode}:${Math.round(size.width / 40)}:${Math.round(width)}`;
    if (seen.current === token) {
      return;
    }
    seen.current = token;
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    const aspect = size.width / Math.max(size.height, 1);
    if (mode === "campus") {
      const halfFov = (camera.fov * Math.PI) / 360;
      const tanHalf = Math.tan(halfFov);
      const distance =
        Math.max(
          54 / (2 * tanHalf * Math.max(aspect, 0.35)),
          46 / (2 * tanHalf),
        ) * 1.15;
      camera.position.set(distance * 0.42, distance * 0.62, distance * 0.58);
      camera.lookAt(0, 1, 0);
      return;
    }
    const span = Math.max(width / Math.max(aspect, 0.45), depth) * 0.72;
    const distance = span / Math.tan((camera.fov * Math.PI) / 360);
    camera.position.set(width * 0.22, distance, depth * 0.38);
    camera.lookAt(0, 0, 0);
  }, [camera, depth, mode, size.height, size.width, width]);

  return null;
}
