import type { MetadataRoute } from "next";
import { games } from "@/lib/catalog";

const baseUrl = "https://aurora-player-web.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const slotPages = games.map((game) => ({
    url: `${baseUrl}/slots/${game.id}`,
    changeFrequency: "weekly" as const,
    priority: game.id === "pharaoh-oasis" ? 0.9 : 0.6,
  }));
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    ...slotPages,
  ];
}
