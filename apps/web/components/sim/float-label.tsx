"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { ink, paper } from "./colors";

export function FloatLabel({
  value,
  title = "",
  position,
  scale = 1,
  tone = "light",
}: {
  value: string;
  title?: string;
  position: [number, number, number];
  scale?: number;
  tone?: "light" | "dark";
}) {
  const map = useLabelTexture(title, value, tone);
  return (
    <Billboard position={position}>
      <mesh scale={[1.2 * scale, (title ? 0.6 : 0.42) * scale, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={map} transparent toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function useLabelTexture(title: string, value: string, tone: "light" | "dark") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return { canvas, map };
  }, []);

  useLayoutEffect(() => {
    const ctx = texture.canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const { canvas, map } = texture;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = tone === "dark" ? ink : "#ffffff";
    ctx.strokeStyle = tone === "dark" ? ink : "rgba(31, 28, 24, 0.18)";
    ctx.lineWidth = 6;
    roundedRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = tone === "dark" ? paper : ink;
    if (title) {
      ctx.fillStyle = tone === "dark" ? paper : "#6d675f";
      drawFitted(
        ctx,
        title.toUpperCase(),
        104,
        42,
        "600",
        "ui-monospace, SFMono-Regular, Menlo, monospace",
        canvas.width - 64,
      );
      ctx.fillStyle = tone === "dark" ? paper : ink;
    }
    drawFitted(
      ctx,
      value,
      title ? 190 : 150,
      title ? 78 : 92,
      "600",
      "ui-sans-serif, system-ui, sans-serif",
      canvas.width - 48,
    );
    map.needsUpdate = true;
  }, [texture, title, tone, value]);

  useEffect(() => {
    return () => {
      texture.map.dispose();
    };
  }, [texture]);

  return texture.map;
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxSize: number,
  weight: string,
  family: string,
  maxWidth: number,
) {
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  ctx.fillText(text, ctx.canvas.width / 2, y);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
