import Image from "next/image";
import Link from "next/link";
import type { GameCard } from "@/lib/catalog";

/** Ehrliche Zwischenseite fuer Slots, die im Web noch nicht spielbar sind. */
export function ComingSoon({ game }: Readonly<{ game: GameCard }>) {
  return <main className="coming-soon-stage">
    <div className="coming-soon-card">
      <div className="coming-soon-cover">
        <Image src={game.cover} alt={`${game.name} Slot-Cover`} fill sizes="(max-width: 600px) 92vw, 480px" quality={82} priority />
        <span className="coming-soon-chip">Bald im Web</span>
      </div>
      <small>{game.category}</small>
      <h1>{game.name}</h1>
      <p>{game.features}</p>
      <p className="coming-soon-note">Diese Welt wird gerade fuer den Browser umgesetzt. In der Aurora-App ist sie bereits spielbar – im Web kannst du solange Pharaoh Oasis drehen.</p>
      <div className="coming-soon-actions">
        <Link className="primary-button" href="/slots/pharaoh-oasis">Pharaoh Oasis spielen</Link>
        <Link className="ghost-button" href="/">Zurueck zur Lobby</Link>
      </div>
    </div>
  </main>;
}
