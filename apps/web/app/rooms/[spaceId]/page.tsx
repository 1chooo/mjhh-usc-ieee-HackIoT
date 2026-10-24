import { redirect } from "next/navigation";
import { getSpace } from "../../../lib/campus";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  if (!getSpace(spaceId)) {
    redirect("/dashboard");
  }
  redirect(`/dashboard?room=${spaceId}`);
}
