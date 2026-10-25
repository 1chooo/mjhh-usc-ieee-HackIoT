import type { Metadata } from "next";
import { ImpactView } from "../../components/impact-view";

export const metadata: Metadata = {
  title: "Impact",
  description: "Dollars saved in the live room.",
};

export default function ImpactPage() {
  return <ImpactView />;
}
