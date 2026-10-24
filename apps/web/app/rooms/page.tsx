import type { Metadata } from "next";
import { RoomBoard } from "../../components/console/room-board";

export const metadata: Metadata = {
  title: "Rooms",
  description: "Library and classroom status for the shared demo hour.",
};

export default function RoomsPage() {
  return <RoomBoard />;
}
