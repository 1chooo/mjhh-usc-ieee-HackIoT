import type { Metadata } from "next";
import { Suspense } from "react";
import {
  SimulatorFallback,
  SimulatorView,
} from "../../components/simulator-view";

export const metadata: Metadata = {
  title: "Simulator",
  description:
    "Change the factors and see whether the room should heat, cool, or hold.",
};

export default function SimulatorPage() {
  return (
    <Suspense fallback={<SimulatorFallback />}>
      <SimulatorView />
    </Suspense>
  );
}
