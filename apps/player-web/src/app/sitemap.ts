import type { MetadataRoute } from "next";
import { games } from "@/lib/catalog";
import { legalDocuments } from "@/lib/legal-content";

const baseUrl = "https://aurora-player-web.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const slotPages = games.map((game) => ({
    url: `${baseUrl}/slots/${game.id}`,
    changeFrequency: "weekly" as const,
    priority: game.id === "pharaoh-oasis" ? 0.9 : 0.6,
  }));
  const legalPages = legalDocuments.map((entry) => ({
    url: `${baseUrl}/legal/${entry.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    ...slotPages,
    ...legalPages,
  ];
}
