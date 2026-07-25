"use client";

import { usePathname } from "next/navigation";

const worldIds = new Set([
  "pharaoh-oasis",
  "dragon-peak",
  "candy-carnival",
  "pirate-bay",
  "neon-nights",
  "frozen-kingdom",
  "jungle-temple",
  "vegas-gold",
  "midnight-saloon",
  "cosmic-voyage",
]);

function WorldDetails({ world }: Readonly<{ world: string }>) {
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
    default:
      return null;
  }
}

export function SlotWorldChrome() {
  const pathname = usePathname();
  const match = pathname.match(/^\/slots\/([^/?#]+)/);
  const world = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!world || !worldIds.has(world)) return null;

  return <div className={`slot-world-chrome world-${world}`} aria-hidden="true"><WorldDetails world={world} /></div>;
}
