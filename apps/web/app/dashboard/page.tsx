import type { Metadata } from "next";
import { RoomBoard } from "../../components/room-board";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "See each simulated room's call and the energy compared with a fixed setpoint.",
};

export default function DashboardPage() {
  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">Operator view</p>
        <h1>What the rooms are asking for</h1>
        <p className="lede">
          Each card runs the same model as the simulator. Savings are against a
          thermostat stuck at the middle of that room&apos;s comfort band. A
          negative hour means the votes asked for more conditioning.
        </p>
      </header>
      <RoomBoard detailed />
    </div>
  );
}
