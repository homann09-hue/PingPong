import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "../mobile/assets");
const target = resolve(root, "public/assets");
const files = [
  "fonts/AuroraSans-Regular.ttf",
  "ui/player-avatar.png",
  ...["candy_carnival", "dragon_peak", "frozen_kingdom", "jungle_temple", "neon_nights", "pharaoh_oasis", "pirate_bay", "vegas_gold", "verdant_afterfall"].map((name) => `slots/${name}.png`),
  ...["ankh", "pharaoh", "pyramid", "scarab", "scatter", "wild"].map((name) => `symbols/pharaoh/${name}.png`),
];

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
const manifest = {};
for (const relative of files) {
  const input = resolve(source, relative);
  const output = resolve(target, relative);
  await mkdir(dirname(output), { recursive: true });
  await cp(input, output);
  const bytes = await readFile(input);
  manifest[relative] = {
    revision: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
    bytes: bytes.byteLength,
    delivery: "next-image-avif-webp",
    qualityTiers: [55, 72, 86],
  };
}
await writeFile(resolve(target, "manifest.json"), `${JSON.stringify({ version: 1, assets: manifest }, null, 2)}\n`);
console.log(`Synced ${files.length} canonical assets to ${target}`);
