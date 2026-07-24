import { readFile, writeFile } from "node:fs/promises";

const path = "apps/mobile/lib/widgets/top_hud.dart";
let content = await readFile(path, "utf8");

const importLine = "import '../services/player_progression.dart';";
if (!content.includes(importLine)) {
  const anchor = "import 'package:flutter/material.dart';\n";
  if (!content.includes(anchor)) throw new Error("TopHud material import anchor not found");
  content = content.replace(anchor, `${anchor}\n${importLine}\n`);
}

const oldProgress = "          value: (xp % 1000) / 1000,";
const newProgress = "          value: playerLevelProgress(level: level, xp: xp),";
if (!content.includes(newProgress)) {
  if (!content.includes(oldProgress)) throw new Error("TopHud fixed XP progress expression not found");
  content = content.replace(oldProgress, newProgress);
}

if ((content.match(/playerLevelProgress\(/g) ?? []).length !== 1) {
  throw new Error("TopHud must contain exactly one curve-v1 progress expression");
}

await writeFile(path, content, "utf8");
console.log("Mobile progression HUD updated to curve v1.");
