import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { SlotGame } from "@/components/slot-game";
import { games } from "@/lib/catalog";

export default async function SlotPage({ params }: Readonly<{ params: Promise<{ slotId: string }> }>) {
  const { slotId } = await params;
  if (slotId === "pharaoh-oasis") return <SlotGame />;
  const game = games.find((entry) => entry.id === slotId);
  if (!game) notFound();
  return <ComingSoon game={game} />;
}
