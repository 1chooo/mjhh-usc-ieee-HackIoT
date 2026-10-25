import type { Metadata } from "next";
import { References } from "../../components/references";

export const metadata: Metadata = {
  title: "References",
  description:
    "IEEE sources for the MJHH cooling estimate, LADWP rates, and setpoint model.",
};

export default function ReferencePage() {
  return <References />;
}
