import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SlotGame } from "@/components/slot-game";
import { findGame, games } from "@/lib/catalog";

export function generateStaticParams() {
  return games.map((game) => ({ slotId: game.id }));
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ slotId: string }> }>): Promise<Metadata> {
  const { slotId } = await params;
  const game = findGame(slotId);
  if (!game) return { title: "Slot nicht gefunden" };
  return {
    title: game.name,
    description: `${game.name}: ${game.features}. Kostenloses Social-Casino-Spiel mit virtuellem Spielgeld.`,
    alternates: { canonical: `/slots/${game.id}` },
  };
}

export default async function SlotPage({ params }: Readonly<{ params: Promise<{ slotId: string }> }>) {
  const { slotId } = await params;
  const game = findGame(slotId);
  if (!game) notFound();
  return <SlotGame game={game} />;
}
