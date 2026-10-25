"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Campus } from "./campus";
import { Fleet, fleetLayout } from "./fleet";
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
  fleet,
}: SimCanvasProps) {
  const room = roomFootprint(scenario.floorAreaM2, scenario.kind);
  const open = mode !== "room" || scenario.scheduledOpen;
  // How far the fleet spreads, so the camera, fog and shadows can follow it.
  const fleetSpan = fleetLayout(fleet.count, fleet.width, fleet.depth);
  const fleetExtent = Math.max(fleetSpan.spanX, fleetSpan.spanZ);
  const far = mode === "fleet" ? Math.max(80, fleetExtent * 2.5) : mode === "room" ? 36 : 80;
  const fleetLift = mode === "fleet" ? fleetSpan.height / 3 : 0;
  // The sun's shadow box has to cover the whole campus, not just one room.
  const shadowReach = mode === "fleet" ? fleetExtent * 0.75 + 20 : 40;
  const target = useMemo<[number, number, number]>(
    () => (mode === "room" ? [0, 0.4, 0] : [0, fleetLift, 0]),
    [mode, fleetLift],
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
        args={[paper, far, mode === "room" ? 120 : Math.max(360, far * 4)]}
      />
      <ambientLight intensity={open ? 0.82 : 0.32} />
      <hemisphereLight args={["#f7f4ef", "#e4ddd2", open ? 0.42 : 0.14]} />
      <directionalLight
        position={[18, 28, 14]}
        intensity={open ? 1.15 : 0.42}
        castShadow
        shadow-mapSize={mode === "fleet" ? [2048, 2048] : [1024, 1024]}
        shadow-camera-far={mode === "fleet" ? shadowReach * 3 : 90}
        shadow-camera-left={-shadowReach}
        shadow-camera-right={shadowReach}
        shadow-camera-top={shadowReach}
        shadow-camera-bottom={-shadowReach}
        shadow-bias={mode === "fleet" ? -0.0006 : 0}
        shadow-normalBias={mode === "fleet" ? 0.04 : 0}
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
      {mode === "fleet" ? (
        <Fleet shape={fleet} />
      ) : mode === "room" ? (
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
        scale={mode === "room" ? 28 : mode === "fleet" ? fleetExtent + 20 : 70}
        blur={2.2}
        far={8}
        color="#1f1c18"
      />
      <OrbitControls
        makeDefault
        enablePan
        maxPolarAngle={Math.PI / 2.08}
        minDistance={mode === "room" ? 4 : 14}
        maxDistance={mode === "room" ? 42 : mode === "fleet" ? Math.max(90, fleetExtent * 3) : 90}
        target={target}
      />
      <CameraFrame mode={mode} width={room.width} depth={room.depth} fleetX={fleetSpan.spanX} fleetZ={fleetSpan.spanZ} fleetH={fleetSpan.height} />
    </Canvas>
  );
}

function CameraFrame({
  mode,
  width,
  depth,
  fleetX,
  fleetZ,
  fleetH,
}: {
  mode: SimMode;
  width: number;
  depth: number;
  fleetX: number;
  fleetZ: number;
  fleetH: number;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const seen = useRef<string | null>(null);

  useLayoutEffect(() => {
    const token = `${mode}:${Math.round(size.width / 40)}:${Math.round(width)}:${mode === "fleet" ? `${Math.round(fleetX)}x${Math.round(fleetZ)}x${Math.round(fleetH)}` : 0}`;
    if (seen.current === token) {
      return;
    }
    seen.current = token;
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    if (mode !== "fleet" && (camera.far !== 220 || camera.near !== 0.1)) {
      camera.far = 220;
      camera.near = 0.1;
      camera.updateProjectionMatrix();
    }
    const aspect = size.width / Math.max(size.height, 1);
    if (mode === "fleet") {
      // Looking down at an angle so the floors read, far enough to fit every building
      // with room for the panels around the edges.
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const fit = Math.max((fleetZ * 0.75 + fleetH + 6) / (2 * tanHalf), (fleetX + 6) / (2 * tanHalf * aspect)) * 1.3;
      const dir = new THREE.Vector3(0.28, 0.78, 0.56).normalize();
      camera.position.set(dir.x * fit, fleetH / 3 + dir.y * fit, dir.z * fit);
      camera.lookAt(0, fleetH / 3, 0);
      camera.far = Math.max(220, fit * 3);
      camera.near = Math.max(0.5, fit * 0.03); // depth precision for a whole campus far away
      camera.updateProjectionMatrix();
      return;
    }
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
  }, [camera, depth, fleetH, fleetX, fleetZ, mode, size.height, size.width, width]);

  return null;
}
