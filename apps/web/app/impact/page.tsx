import type { Metadata } from "next";
import { ImpactView } from "../../components/impact-view";

export const metadata: Metadata = {
  title: "Impact",
  description:
    "Shared demo of one simulated hour against a fixed setpoint. Not a utility bill.",
};

export default function ImpactPage() {
  return <ImpactView />;
}
