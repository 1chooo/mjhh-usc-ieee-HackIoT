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
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">Algorithm lab</p>
        <h1>Move one factor and watch the hour change.</h1>
        <p className="lede">
          The sliders are the inputs the policy uses. The note beside each
          result says how that input entered the call.
        </p>
      </header>
      <Suspense fallback={<SimulatorFallback />}>
        <SimulatorView />
      </Suspense>
    </div>
  );
}
