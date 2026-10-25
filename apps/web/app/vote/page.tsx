import type { Metadata } from "next";
import { VoteView } from "../../components/vote-view";

export const metadata: Metadata = {
  title: "Vote",
  description: "Tell the room whether it feels too cold or too hot.",
};

export default function VotePage() {
  return <VoteView />;
}
