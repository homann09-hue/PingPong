"use client";

import { usePathname } from "next/navigation";

const worlds = {
  "pharaoh-oasis": { cabinet: "temple", marquee: "Tomb of the Sun", mechanic: "Mystery Chambers", atmosphere: "Goldener Wüstentempel" },
  "dragon-peak": { cabinet: "forge", marquee: "Forge of the Dragon", mechanic: "Cascade Climb", atmosphere: "Vulkanische Bergfestung" },
  "candy-carnival": { cabinet: "carnival", marquee: "Sweetstorm Carnival", mechanic: "Cluster Blast", atmosphere: "Leuchtender Zuckerjahrmarkt" },
  "pirate-bay": { cabinet: "galleon", marquee: "Captain's Vault", mechanic: "Treasure Pick", atmosphere: "Sturmgaleone bei Nacht" },
  "neon-nights": { cabinet: "nightclub", marquee: "Midnight Hyperclub", mechanic: "Walking Wild Rush", atmosphere: "Chromstadt und Neonclub" },
  "frozen-kingdom": { cabinet: "ice-palace", marquee: "Throne of Winter", mechanic: "Frozen Free Spins", atmosphere: "Kristallpalast im Schneesturm" },
  "jungle-temple": { cabinet: "jungle-shrine", marquee: "Emerald Shrine", mechanic: "Temple Wheel", atmosphere: "Überwachsene Ruinen im Monsun" },
  "vegas-gold": { cabinet: "vegas-floor", marquee: "The Golden Strip", mechanic: "Hold & Win", atmosphere: "Art-déco-Casino am Strip" },
  "midnight-saloon": { cabinet: "saloon", marquee: "Dead Man's Reel", mechanic: "Outlaw Respins", atmosphere: "Verrauchter Saloon bei Mitternacht" },
  "cosmic-voyage": { cabinet: "starship", marquee: "Event Horizon", mechanic: "Warp Wilds", atmosphere: "Raumschiff am Rand eines Nebels" },
} as const;

type WorldId = keyof typeof worlds;

function WorldDetails({ world }: Readonly<{ world: WorldId }>) {
  switch (world) {
    case "pharaoh-oasis":
      return <><i className="world-sun" /><i className="world-obelisk left" /><i className="world-obelisk right" /><i className="world-dust a" /><i className="world-dust b" /></>;
    case "dragon-peak":
      return <><i className="world-forge-arch" /><i className="world-chain left" /><i className="world-chain right" /><i className="world-ember a" /><i className="world-ember b" /><i className="world-ember c" /></>;
    case "candy-carnival":
      return <><i className="world-candy-wheel" /><i className="world-balloon a" /><i className="world-balloon b" /><i className="world-sugar-orbit" /></>;
    case "pirate-bay":
      return <><i className="world-mast" /><i className="world-rope left" /><i className="world-rope right" /><i className="world-wave a" /><i className="world-wave b" /><i className="world-lantern" /></>;
    case "neon-nights":
      return <><i className="world-skyline" /><i className="world-laser a" /><i className="world-laser b" /><i className="world-equalizer" /><i className="world-disc" /></>;
    case "frozen-kingdom":
      return <><i className="world-ice-crown" /><i className="world-icicles" /><i className="world-snow a" /><i className="world-snow b" /><i className="world-snow c" /></>;
    case "jungle-temple":
      return <><i className="world-shrine" /><i className="world-vine left" /><i className="world-vine right" /><i className="world-leaf a" /><i className="world-leaf b" /><i className="world-rain" /></>;
    case "vegas-gold":
      return <><i className="world-deco-fan left" /><i className="world-deco-fan right" /><i className="world-bulbs" /><i className="world-spotlight a" /><i className="world-spotlight b" /></>;
    case "midnight-saloon":
      return <><i className="world-saloon-doors" /><i className="world-lamp left" /><i className="world-lamp right" /><i className="world-smoke a" /><i className="world-smoke b" /></>;
    case "cosmic-voyage":
      return <><i className="world-planet" /><i className="world-warp a" /><i className="world-warp b" /><i className="world-starfield" /><i className="world-comet" /></>;
  }
}

export function SlotWorldChrome() {
  const pathname = usePathname();
  const match = pathname.match(/^\/slots\/([^/?#]+)/);
  const rawWorld = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!rawWorld || !(rawWorld in worlds)) return null;

  const world = rawWorld as WorldId;
  const config = worlds[world];
  return <div className={`slot-world-chrome world-${world} cabinet-${config.cabinet}`} data-world={world} data-cabinet={config.cabinet} aria-hidden="true">
    <div className="cabinet-identity">
      <span className="cabinet-kicker">Aurora Original</span>
      <strong className="cabinet-marquee">{config.marquee}</strong>
      <span className="cabinet-atmosphere">{config.atmosphere}</span>
    </div>
    <div className="cabinet-mechanic"><small>Feature</small><strong>{config.mechanic}</strong><i /></div>
    <div className="cabinet-side-lights left" /><div className="cabinet-side-lights right" />
    <div className="cabinet-floor-glow" />
    <WorldDetails world={world} />
  </div>;
}
