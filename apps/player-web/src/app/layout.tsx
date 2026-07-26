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
import "./premium-live.css";
import "./premium-category-nav.css";
import "./premium-community.css";
import "./premium-game-tiles.css";
import "./premium-shell.css";
import "./premium-welcome.css";
import "./premium-liveops.css";
import "./premium-pass.css";
import "./premium-social-promo.css";
import "./premium-jackpot-recent.css";
import "./premium-achievements.css";
import "./premium-placement.css";
import "./premium-sections.css";
import "./premium-account.css";
import "./premium-mobile-menu.css";
import "./slot-premium-polish.css";
import "./slot-spin-states.css";
import "./slot-cabinet-v2.css";
import "./slot-auto-spin.css";
import "./slot-performance-hud.css";
import "./slot-win-feed.css";
import "./slot-feature-cards.css";
import "./slot-quick-bet.css";
import "./slot-feature-status.css";
import "./slot-session-stats.css";
import "./slot-immersive-controls.css";
import "./mobile-polish-v2.css";
import "./slot-mobile-session.css";
import "./slot-clean-layout.css";
import "./slot-worlds.css";
import "./slot-world-chrome.css";
import "./slot-round-presentation.css";
import "./slot-mechanic-fx.css";
import "./slot-feature-hud.css";
import "./slot-feature-status-live.css";
import "./slot-cell-feature-fx.css";
import "./slot-cascade-sequence.css";
import "./slot-walking-wild-path.css";
import "./slot-bonus-presentation.css";
import "./slot-feature-reveal-sequence.css";
import "./slot-mechanic-sync.css";
import "./slot-win-overlay.css";
import "./slot-win-focus.css";
import "./canva-v2-system.css";
import "./wow-motion-v3.css";
import "./lobby-live-service-deck.css";
import "./lobby-live-service-final.css";
import "./canva-shell-perfection.css";
import "./canva-shell-conflict-guard.css";
import "./canva-motion-perfection.css";
import "./celebration-hub.css";
import "./canva-slot-cabinet-perfection.css";
import "./canva-slot-cabinet-final.css";
import "./canva-symbol-art-perfection.css";
import { AgeGate } from "@/components/age-gate";
import { CelebrationHub } from "@/components/celebration-hub";
import { LegalFooter } from "@/components/legal-footer";
import { MotionOrchestrator } from "@/components/motion-orchestrator";
import { SlotWorldChrome } from "@/components/slot-world-chrome";

export const metadata: Metadata = {
  title: { default: "Aurora Casino", template: "%s · Aurora Casino" },
  description: "Kostenlose Social-Casino-Slots mit virtuellen Coins, Missionen, Events, Jackpots und geteiltem Fortschritt.",
  applicationName: "Aurora Casino",
  metadataBase: new URL("https://aurora-player-web.vercel.app"),
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/assets/ui/player-avatar.png", apple: "/assets/ui/player-avatar.png" },
  openGraph: { title: "Aurora Casino", description: "Kostenlose Social-Casino-Slots mit virtuellen Coins, Missionen, Events und Jackpots.", images: ["/assets/slots/pharaoh_oasis.png"] },
};

export const viewport: Viewport = { viewportFit: "cover", width: "device-width", initialScale: 1, themeColor: "#120529", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" data-scroll-behavior="smooth"><body><AgeGate /><SlotWorldChrome /><MotionOrchestrator /><CelebrationHub />{children}<LegalFooter /></body></html>;
}
