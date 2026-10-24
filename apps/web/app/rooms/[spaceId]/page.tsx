import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomDetail } from "../../../components/console/room-detail";
import {
  defaultReadings,
  evaluateSpace,
  getSpace,
} from "../../../lib/campus";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}): Promise<Metadata> {
  const { spaceId } = await params;
  const space = getSpace(spaceId);
  return { title: space?.name ?? "Room" };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const space = getSpace(spaceId);
  const reading = space ? defaultReadings[space.id] : undefined;
  if (!space || !reading) {
    notFound();
  }

  return (
    <RoomDetail
      mode="public"
      room={{ space, reading, result: evaluateSpace(space, reading) }}
      ready
    />
  );
}
