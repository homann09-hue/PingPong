import type { Metadata, Viewport } from "next";
import "@aurora/design-tokens/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Aurora Casino", template: "%s · Aurora Casino" },
  description: "Play free social casino slots with virtual coins, missions, events, jackpots, and shared progress.",
  applicationName: "Aurora Casino",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#120b2b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
