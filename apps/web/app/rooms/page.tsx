import type { Metadata } from "next";
import { RoomBoard } from "../../components/console/room-board";

export const metadata: Metadata = {
  title: "Rooms",
  description: "Live room temperature, people, votes, and setpoint.",
};

export default function RoomsPage() {
  return <RoomBoard />;
}
