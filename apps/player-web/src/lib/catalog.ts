export interface GameCard {
  readonly id: string;
  readonly name: string;
  readonly cover: string;
  readonly category: string;
  readonly features: string;
  readonly unlockLevel: number;
  /** Symbolsatz-Ordner unter /assets/symbols. */
  readonly symbolSet: string;
  /** Themenfarben fuer Rahmen, Gewinnhervorhebung und Verlaeufe. */
  readonly primary: string;
  readonly secondary: string;
  readonly featured?: boolean;
  readonly isNew?: boolean;
  readonly highRoller?: boolean;
  /** Nur mit aktiver High-Roller-Mitgliedschaft spielbar. */
  readonly bonusBuyMultiplier?: number;
}

export const games: readonly GameCard[] = [
  { id: "pharaoh-oasis", name: "Pharaoh Oasis", cover: "/assets/slots/pharaoh_oasis.png", category: "Ancient", features: "Mystery-Enthuellungen · Expanding Wilds · 2× Freispiele", unlockLevel: 1, symbolSet: "pharaoh", primary: "#ffb52c", secondary: "#6b2bd9", featured: true },
  { id: "dragon-peak", name: "Dragon Peak", cover: "/assets/slots/dragon_peak.png", category: "Adventure", features: "Kaskaden · Drachen-Wilds · Freispiel-Leiter bis ×5", unlockLevel: 4, symbolSet: "dragon", primary: "#ff5b25", secondary: "#821411", featured: true },
  { id: "candy-carnival", name: "Candy Carnival", cover: "/assets/slots/candy_carnival.png", category: "Cascade", features: "32–3125 variable Ways · Sticky Wilds · Kaskaden", unlockLevel: 8, symbolSet: "candy", primary: "#ff4fc3", secondary: "#7b2cff" },
  { id: "pirate-bay", name: "Pirate Bay", cover: "/assets/slots/pirate_bay.png", category: "Bonus", features: "Schatzkarte mit 3 Picks · Coin Collect · Bonus-Buy", unlockLevel: 12, symbolSet: "pirate", primary: "#24a9df", secondary: "#073f8c", featured: true, isNew: true, bonusBuyMultiplier: 32 },
  { id: "neon-nights", name: "Neon Nights", cover: "/assets/slots/neon_nights.png", category: "High Roller", features: "Walking Wilds · ×2-Multiplikator-Symbole · 8 Freispiele", unlockLevel: 5, symbolSet: "neon", primary: "#ff35dc", secondary: "#1369ff", isNew: true, highRoller: true },
  { id: "frozen-kingdom", name: "Frozen Kingdom", cover: "/assets/slots/frozen_kingdom.png", category: "Freispiele", features: "Spezielle Freispiel-Walzen · +1 Eis-Wild · Retrigger", unlockLevel: 7, symbolSet: "frozen", primary: "#52e7ff", secondary: "#2453b8" },
  { id: "jungle-temple", name: "Jungle Temple", cover: "/assets/slots/jungle_temple.png", category: "Mega Features", features: "Kaskaden bis ×12 · Symbol-Upgrades · Tempel-Rad", unlockLevel: 15, symbolSet: "jungle", primary: "#ffc82f", secondary: "#087a55", featured: true, isNew: true, bonusBuyMultiplier: 50 },
  { id: "vegas-gold", name: "Vegas Gold", cover: "/assets/slots/vegas_gold.png", category: "Classic Vegas", features: "Both Ways · Hold & Win · 4 Jackpots", unlockLevel: 20, symbolSet: "vegas", primary: "#ffc52f", secondary: "#8b101c", isNew: true, bonusBuyMultiplier: 50 },
] as const;

export function findGame(id: string): GameCard | undefined {
  return games.find((game) => game.id === id);
}

/**
 * Zuordnung Engine-Symbolcode zu Bilddatei je Symbolsatz.
 * Quelle: apps/mobile/lib/screens/slot_screen.dart (identische Wertigkeiten).
 */
const symbolFiles: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  pharaoh: { A: "pharaoh", K: "scarab", Q: "ankh", J: "pyramid", W: "wild", S: "scatter", B: "scatter" },
  dragon: { A: "dragon", K: "egg", Q: "sword", J: "shield", W: "wild", S: "scatter", B: "scatter" },
  candy: { A: "bear", K: "lollipop", Q: "cupcake", J: "crown", W: "wild-v2", S: "scatter", B: "scatter" },
  pirate: { A: "captain", K: "parrot", Q: "compass", J: "ship", W: "wild", S: "scatter", B: "scatter" },
  neon: { A: "star", K: "car", Q: "champagne", J: "diamond", W: "wild", S: "scatter", B: "scatter" },
  frozen: { A: "snowflake", K: "wolf", Q: "scepter", J: "heart", W: "wild", S: "scatter", B: "scatter" },
  jungle: { A: "jaguar", K: "idol", Q: "macaw", J: "emerald", W: "wild", S: "scatter", B: "scatter" },
  vegas: { A: "roulette", K: "dice", Q: "seven", J: "chip", W: "wild", S: "scatter", B: "scatter" },
};

/** Bildpfad fuer einen Engine-Symbolcode, oder undefined fuer Textsymbole. */
export function symbolAsset(symbolSet: string, symbol: string): string | undefined {
  const file = symbolFiles[symbolSet]?.[symbol];
  return file ? `/assets/symbols/${symbolSet}/${file}.png` : undefined;
}

export const lowSymbolLabels: Readonly<Record<string, string>> = { X: "10", Y: "9", Z: "8", T: "7" };
