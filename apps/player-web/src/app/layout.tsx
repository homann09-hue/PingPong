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
import "./lotsa-app.css";
import "./lotsa-menus.css";
import { AgeGate } from "@/components/age-gate";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: { default: "Aurora Slots", template: "%s · Aurora Slots" },
  description: "Mobile Social-Casino-App mit eigenständigen Themen-Slots, Missionen, Events, Club, Boostern und virtuellen Coins.",
  applicationName: "Aurora Slots",
  metadataBase: new URL("https://aurora-player-web.vercel.app"),
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/assets/ui/player-avatar.png", apple: "/assets/ui/player-avatar.png" },
  openGraph: {
    title: "Aurora Slots",
    description: "Themen-Slots, Missionen, Events und Social-Casino-Progression mit virtuellem Spielgeld.",
    images: ["/assets/slots/pharaoh_oasis.png"],
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  themeColor: "#18052f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" data-scroll-behavior="smooth"><body><AgeGate />{children}<LegalFooter /></body></html>;
}
