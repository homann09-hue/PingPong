import type { Metadata, Viewport } from "next";
import "@aurora/design-tokens/tokens.css";
import "./globals.css";
import "./fixes.css";

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
  width: "device-width",
  initialScale: 1,
  themeColor: "#120b2b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
