import type { HvacAction } from "../../lib/thermal";

export const paper = "#f6f4ef";
export const ink = "#1f1c18";
export const floor = "#efeae3";
export const wall = "#f7f4ef";
export const shelf = "#cbbba6";
export const table = "#e4dcd0";
export const desk = "#d9d1c4";
export const hot = "#c4623a";
export const cold = "#3e5c8a";
export const person = "#8d877e";
export const gridLine = "#d9d3c9";

export function outdoorTint(celsius: number): string {
  if (celsius < 16) {
    return "#b7c6d8";
  }
  if (celsius > 26) {
    return "#e8c09a";
  }
  return "#d7e0d6";
}

export function actionColor(action: HvacAction): string {
  if (action === "heat") {
    return hot;
  }
  if (action === "cool") {
    return cold;
  }
  return "#f4f1ea";
}
