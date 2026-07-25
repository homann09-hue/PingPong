export type SlotCabinetMode = "temple" | "forge" | "carnival" | "galleon" | "nightclub" | "ice-palace" | "jungle-shrine" | "vegas-floor" | "saloon" | "starship";

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
  /** Jede Spielwelt besitzt ein eigenstaendiges Kabinett und eine eigene Inszenierung. */
  readonly cabinet: SlotCabinetMode;
  readonly marquee: string;
  readonly mechanicLabel: string;
  readonly atmosphere: string;
  readonly featured?: boolean;
  readonly isNew?: boolean;
  readonly highRoller?: boolean;
  /** Nur mit aktiver High-Roller-Mitgliedschaft spielbar. */
  readonly bonusBuyMultiplier?: number;
}

export const games: readonly GameCard[] = [
  {
    id: "pharaoh-oasis", name: "Pharaoh Oasis", cover: "/assets/slots/pharaoh_oasis.svg", category: "Ancient",
    features: "Mystery-Enthüllungen · Expanding Wilds · 2× Freispiele", unlockLevel: 1, symbolSet: "pharaoh",
    primary: "#ffb52c", secondary: "#6b2bd9", cabinet: "temple", marquee: "Tomb of the Sun",
    mechanicLabel: "Mystery Chambers", atmosphere: "Goldener Wüstentempel", featured: true,
  },
  {
    id: "dragon-peak", name: "Dragon Peak", cover: "/assets/slots/dragon_peak.svg", category: "Adventure",
    features: "Kaskaden · Drachen-Wilds · Freispiel-Leiter bis ×5", unlockLevel: 4, symbolSet: "dragon",
    primary: "#ff5b25", secondary: "#821411", cabinet: "forge", marquee: "Forge of the Dragon",
    mechanicLabel: "Cascade Climb", atmosphere: "Vulkanische Bergfestung", featured: true,
  },
  {
    id: "candy-carnival", name: "Candy Carnival", cover: "/assets/slots/candy_carnival.svg", category: "Cascade",
    features: "32–3125 variable Ways · Sticky Wilds · Kaskaden", unlockLevel: 8, symbolSet: "candy",
    primary: "#ff4fc3", secondary: "#7b2cff", cabinet: "carnival", marquee: "Sweetstorm Carnival",
    mechanicLabel: "Cluster Blast", atmosphere: "Leuchtender Zuckerjahrmarkt",
  },
  {
    id: "pirate-bay", name: "Pirate Bay", cover: "/assets/slots/pirate_bay.svg", category: "Bonus",
    features: "Schatzkarte mit 3 Picks · Coin Collect · Bonus-Buy", unlockLevel: 12, symbolSet: "pirate",
    primary: "#24a9df", secondary: "#073f8c", cabinet: "galleon", marquee: "Captain's Vault",
    mechanicLabel: "Treasure Pick", atmosphere: "Sturmgaleone bei Nacht", featured: true, isNew: true, bonusBuyMultiplier: 32,
  },
  {
    id: "neon-nights", name: "Neon Nights", cover: "/assets/slots/neon_nights.svg", category: "High Roller",
    features: "Walking Wilds · ×2-Multiplikator-Symbole · 8 Freispiele", unlockLevel: 5, symbolSet: "neon",
    primary: "#ff35dc", secondary: "#1369ff", cabinet: "nightclub", marquee: "Midnight Hyperclub",
    mechanicLabel: "Walking Wild Rush", atmosphere: "Chromstadt und Neonclub", isNew: true, highRoller: true,
  },
  {
    id: "frozen-kingdom", name: "Frozen Kingdom", cover: "/assets/slots/frozen_kingdom.svg", category: "Freispiele",
    features: "Spezielle Freispiel-Walzen · +1 Eis-Wild · Retrigger", unlockLevel: 7, symbolSet: "frozen",
    primary: "#52e7ff", secondary: "#2453b8", cabinet: "ice-palace", marquee: "Throne of Winter",
    mechanicLabel: "Frozen Free Spins", atmosphere: "Kristallpalast im Schneesturm",
  },
  {
    id: "jungle-temple", name: "Jungle Temple", cover: "/assets/slots/jungle_temple.svg", category: "Mega Features",
    features: "Kaskaden bis ×12 · Symbol-Upgrades · Tempel-Rad", unlockLevel: 15, symbolSet: "jungle",
    primary: "#ffc82f", secondary: "#087a55", cabinet: "jungle-shrine", marquee: "Emerald Shrine",
    mechanicLabel: "Temple Wheel", atmosphere: "Überwachsene Ruinen im Monsun", featured: true, isNew: true, bonusBuyMultiplier: 50,
  },
  {
    id: "vegas-gold", name: "Vegas Gold", cover: "/assets/slots/vegas_gold.svg", category: "Classic Vegas",
    features: "Both Ways · Hold & Win · 4 Jackpots", unlockLevel: 20, symbolSet: "vegas",
    primary: "#ffc52f", secondary: "#8b101c", cabinet: "vegas-floor", marquee: "The Golden Strip",
    mechanicLabel: "Hold & Win", atmosphere: "Art-déco-Casino am Strip", isNew: true, bonusBuyMultiplier: 50,
  },
  {
    id: "midnight-saloon", name: "Midnight Saloon", cover: "/assets/slots/midnight_saloon.svg", category: "Wild West",
    features: "Expanding Wilds · Respins · 2× Freispiele", unlockLevel: 9, symbolSet: "saloon",
    primary: "#e0a63c", secondary: "#3a1f5c", cabinet: "saloon", marquee: "Dead Man's Reel",
    mechanicLabel: "Outlaw Respins", atmosphere: "Verrauchter Saloon bei Mitternacht", isNew: true,
  },
  {
    id: "cosmic-voyage", name: "Cosmic Voyage", cover: "/assets/slots/cosmic_voyage.svg", category: "Cosmic",
    features: "Walking Wilds · ×2-Multiplikator-Symbole · Freispiele", unlockLevel: 10, symbolSet: "cosmic",
    primary: "#5b8cff", secondary: "#c04cff", cabinet: "starship", marquee: "Event Horizon",
    mechanicLabel: "Warp Wilds", atmosphere: "Raumschiff am Rand eines Nebels", isNew: true,
  },
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
