"use client";

import dynamic from "next/dynamic";
import type { SimCanvasProps } from "./sim-types";

const SimCanvas = dynamic(
  () => import("./sim-canvas").then((mod) => mod.SimCanvas),
  {
    ssr: false,
    loading: () => <p className="note sim-loading">Loading the room…</p>,
  },
);

export function SimStage(props: SimCanvasProps) {
  return <SimCanvas {...props} />;
}
