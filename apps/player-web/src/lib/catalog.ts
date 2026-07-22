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
  { id: "pharaoh-oasis", name: "Pharaoh Oasis", cover: "/assets/slots/pharaoh_oasis.svg", category: "Ancient", features: "Mystery-Enthuellungen ÃÂ· Expanding Wilds ÃÂ· 2ÃÂ Freispiele", unlockLevel: 1, symbolSet: "pharaoh", primary: "#ffb52c", secondary: "#6b2bd9", featured: true },
  { id: "dragon-peak", name: "Dragon Peak", cover: "/assets/slots/dragon_peak.svg", category: "Adventure", features: "Kaskaden ÃÂ· Drachen-Wilds ÃÂ· Freispiel-Leiter bis ÃÂ5", unlockLevel: 4, symbolSet: "dragon", primary: "#ff5b25", secondary: "#821411", featured: true },
  { id: "candy-carnival", name: "Candy Carnival", cover: "/assets/slots/candy_carnival.svg", category: "Cascade", features: "32Ã¢ÂÂ3125 variable Ways ÃÂ· Sticky Wilds ÃÂ· Kaskaden", unlockLevel: 8, symbolSet: "candy", primary: "#ff4fc3", secondary: "#7b2cff" },
  { id: "pirate-bay", name: "Pirate Bay", cover: "/assets/slots/pirate_bay.svg", category: "Bonus", features: "Schatzkarte mit 3 Picks ÃÂ· Coin Collect ÃÂ· Bonus-Buy", unlockLevel: 12, symbolSet: "pirate", primary: "#24a9df", secondary: "#073f8c", featured: true, isNew: true, bonusBuyMultiplier: 32 },
  { id: "neon-nights", name: "Neon Nights", cover: "/assets/slots/neon_nights.svg", category: "High Roller", features: "Walking Wilds ÃÂ· ÃÂ2-Multiplikator-Symbole ÃÂ· 8 Freispiele", unlockLevel: 5, symbolSet: "neon", primary: "#ff35dc", secondary: "#1369ff", isNew: true, highRoller: true },
  { id: "frozen-kingdom", name: "Frozen Kingdom", cover: "/assets/slots/frozen_kingdom.svg", category: "Freispiele", features: "Spezielle Freispiel-Walzen ÃÂ· +1 Eis-Wild ÃÂ· Retrigger", unlockLevel: 7, symbolSet: "frozen", primary: "#52e7ff", secondary: "#2453b8" },
  { id: "jungle-temple", name: "Jungle Temple", cover: "/assets/slots/jungle_temple.svg", category: "Mega Features", features: "Kaskaden bis ÃÂ12 ÃÂ· Symbol-Upgrades ÃÂ· Tempel-Rad", unlockLevel: 15, symbolSet: "jungle", primary: "#ffc82f", secondary: "#087a55", featured: true, isNew: true, bonusBuyMultiplier: 50 },
  { id: "vegas-gold", name: "Vegas Gold", cover: "/assets/slots/vegas_gold.svg", category: "Classic Vegas", features: "Both Ways ÃÂ· Hold & Win ÃÂ· 4 Jackpots", unlockLevel: 20, symbolSet: "vegas", primary: "#ffc52f", secondary: "#8b101c", isNew: true, bonusBuyMultiplier: 50 },
  { id: "midnight-saloon", name: "Midnight Saloon", cover: "/assets/slots/midnight_saloon.svg", category: "Wild West", features: "Expanding Wilds Â· Respins Â· 2Ã Freispiele", unlockLevel: 9, symbolSet: "vegas", primary: "#e0a63c", secondary: "#3a1f5c", isNew: true },
  { id: "cosmic-voyage", name: "Cosmic Voyage", cover: "/assets/slots/cosmic_voyage.svg", category: "Cosmic", features: "Walking Wilds Â· Ã2-Multiplikator-Symbole Â· Freispiele", unlockLevel: 10, symbolSet: "neon", primary: "#5b8cff", secondary: "#c04cff", isNew: true },
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
