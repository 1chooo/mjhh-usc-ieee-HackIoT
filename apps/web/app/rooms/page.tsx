import type { Metadata } from "next";
import { RoomBoard } from "../../components/room-board";

export const metadata: Metadata = {
  title: "Rooms",
  description:
    "Choose a library or classroom and say whether it feels hot or cold.",
};

export default function RoomsPage() {
  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">In the room</p>
        <h1>Which space are you in?</h1>
        <p className="lede">
          Pick the library or classroom around you. Your hot or cold vote is one
          factor in that room&apos;s setpoint.
        </p>
      </header>
      <RoomBoard />
    </div>
  );
}
