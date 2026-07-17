export interface GameCard {
  readonly id: string;
  readonly name: string;
  readonly cover: string;
  readonly category: string;
  readonly features: string;
  readonly unlockLevel: number;
  readonly featured?: boolean;
  readonly isNew?: boolean;
  readonly highRoller?: boolean;
}

export const games: readonly GameCard[] = [
  { id: "pharaoh-oasis", name: "Pharaoh Oasis", cover: "/assets/slots/pharaoh_oasis.png", category: "Ancient", features: "Mystery reveals · Expanding wilds · 2× free spins", unlockLevel: 1, featured: true },
  { id: "dragon-peak", name: "Dragon Peak", cover: "/assets/slots/dragon_peak.png", category: "Adventure", features: "Cascades · Dragon wilds · Ultimate free spins", unlockLevel: 4, featured: true },
  { id: "candy-carnival", name: "Candy Carnival", cover: "/assets/slots/candy_carnival.png", category: "Cascade", features: "Variable ways · Sticky wilds · Cascades", unlockLevel: 8 },
  { id: "pirate-bay", name: "Pirate Bay", cover: "/assets/slots/pirate_bay.png", category: "Bonus games", features: "Treasure picks · Coin collect · Bonus buy", unlockLevel: 12, featured: true, isNew: true },
  { id: "neon-nights", name: "Neon Nights", cover: "/assets/slots/neon_nights.png", category: "High Roller", features: "Walking wilds · Multipliers · Free spins", unlockLevel: 5, isNew: true, highRoller: true },
  { id: "frozen-kingdom", name: "Frozen Kingdom", cover: "/assets/slots/frozen_kingdom.png", category: "Free spins", features: "Special reels · Extra wilds · Retriggers", unlockLevel: 7 },
  { id: "jungle-temple", name: "Jungle Temple", cover: "/assets/slots/jungle_temple.png", category: "Mega features", features: "Cascades · Symbol upgrades · Temple wheel", unlockLevel: 15, featured: true, isNew: true },
  { id: "vegas-gold", name: "Vegas Gold", cover: "/assets/slots/vegas_gold.png", category: "Classic Vegas", features: "Both ways · Hold & win · Four jackpots", unlockLevel: 20, isNew: true },
] as const;

export const pharaohSymbols: Readonly<Record<string, string>> = {
  A: "/assets/symbols/pharaoh/pharaoh.png",
  K: "/assets/symbols/pharaoh/ankh.png",
  Q: "/assets/symbols/pharaoh/scarab.png",
  J: "/assets/symbols/pharaoh/pyramid.png",
  W: "/assets/symbols/pharaoh/wild.png",
  S: "/assets/symbols/pharaoh/scatter.png",
  B: "/assets/symbols/pharaoh/scatter.png",
  R: "/assets/symbols/pharaoh/scarab.png",
};

export const lowSymbolLabels: Readonly<Record<string, string>> = { X: "10", Y: "9", Z: "8", T: "7" };
