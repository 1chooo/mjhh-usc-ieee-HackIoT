import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VotePanel } from "../../../components/vote-panel";
import { getSpace } from "../../../lib/campus";

export function generateStaticParams() {
  return [
    { spaceId: "leavey-reading" },
    { spaceId: "doheny-2" },
    { spaceId: "thh-201" },
    { spaceId: "sal-127" },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}): Promise<Metadata> {
  const { spaceId } = await params;
  const space = getSpace(spaceId);
  if (!space) {
    return { title: "Room" };
  }
  return {
    title: space.name,
    description: `Say whether ${space.building} ${space.name} feels hot or cold.`,
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  if (!getSpace(spaceId)) {
    notFound();
  }
  return <VotePanel spaceId={spaceId} />;
}
