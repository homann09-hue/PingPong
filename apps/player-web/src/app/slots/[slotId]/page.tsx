import { notFound } from "next/navigation";
import { SlotGame } from "@/components/slot-game";

export default async function SlotPage({ params }: Readonly<{ params: Promise<{ slotId: string }> }>) {
  const { slotId } = await params;
  if (slotId !== "pharaoh-oasis") notFound();
  return <SlotGame />;
}
