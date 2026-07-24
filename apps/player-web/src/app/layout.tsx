import type { Metadata, Viewport } from "next";
import "@aurora/design-tokens/tokens.css";
import "./globals.css";
import "./fixes.css";
import "./legal.css";
import "./slot-theme.css";
import "./arcade.css";
import "./boost.css";
import "./wheel.css";
import "./shop.css";
import "./reels.css";
import "./win.css";
import "./jackpots.css";
import "./slot-ambience.css";
import "./wallet-history.css";
import "./clans-ui.css";
import "./slot-intro.css";
import "./mobile.css";
import "./vegas.css";
import "./premium-casino.css";
import { AgeGate } from "@/components/age-gate";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: { default: "Aurora Casino", template: "%s · Aurora Casino" },
  description: "Kostenlose Social-Casino-Slots mit virtuellen Coins, Missionen, Events, Jackpots und geteiltem Fortschritt.",
  applicationName: "Aurora Casino",
  metadataBase: new URL("https://aurora-player-web.vercel.app"),
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/assets/ui/player-avatar.png",
    apple: "/assets/ui/player-avatar.png",
  },
  openGraph: {
    title: "Aurora Casino",
    description: "Kostenlose Social-Casino-Slots mit virtuellen Coins, Missionen, Events und Jackpots.",
    images: ["/assets/slots/pharaoh_oasis.png"],
  },
};

export const viewport: Viewport = {
  // Ohne viewport-fit=cover liefert env(safe-area-inset-*) durchgehend 0 —
  // die Safe-Area-Regeln in mobile.css waeren wirkungslos, und in einer
  // nativen Huelle laege der Home-Indikator auf der unteren Leiste.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  themeColor: "#120b2b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" data-scroll-behavior="smooth"><body><AgeGate />{children}<LegalFooter /></body></html>;
}
