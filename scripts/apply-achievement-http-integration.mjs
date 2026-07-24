import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Expected integration anchor was not found in ${path}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Integration anchor is not unique in ${path}`);
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

const httpApp = "apps/api/src/http-app.ts";
await replaceOnce(
  httpApp,
  'import { achievementById, achievementViews, canClaimAchievement } from "./achievements/achievement-system.js";\n',
  'import { achievementById, achievementViews, canClaimAchievement } from "./achievements/achievement-system.js";\nimport type { AchievementStore } from "./achievements/achievement-store.js";\nimport { AchievementAlreadyClaimedError, AchievementIdempotencyConflictError, AchievementNotClaimableError, AchievementNotFoundError, AchievementPlayerNotFoundError } from "./achievements/achievement-store.js";\n',
);
await replaceOnce(
  httpApp,
  '  readonly authenticator: Authenticator;\n  readonly spinStore: SpinStore;\n',
  '  readonly authenticator: Authenticator;\n  readonly spinStore: SpinStore;\n  readonly achievementStore?: AchievementStore;\n',
);
await replaceOnce(
  httpApp,
  `    const { progression } = profile;\n    const vip = vipStatus(progression.vipPoints);\n    const claimed = new Set(profile.claimedRewards);\n    return {\n      playerId,\n      ...profile,\n      vip,\n      achievements: achievementViews(progression, claimed),\n      tournament,\n    };`,
  `    const { progression } = profile;\n    const vip = vipStatus(progression.vipPoints);\n    const claimed = new Set(profile.claimedRewards);\n    const achievements = dependencies.achievementStore\n      ? await dependencies.achievementStore.list(playerId, new Date())\n      : achievementViews(progression, claimed);\n    return {\n      playerId,\n      ...profile,\n      vip,\n      achievements,\n      tournament,\n    };`,
);
await replaceOnce(
  httpApp,
  `    const achievement = achievementById(requestedReward);\n    const coins = achievement?.coins ?? rewardAmounts.get(requestedReward);\n    if (!coins) return reply.code(404).send({ code: "REWARD_NOT_FOUND" });\n    if (achievement) {\n      const profile = await dependencies.spinStore.getProfile(playerId);\n      if (!canClaimAchievement(achievement, profile.progression, new Set(profile.claimedRewards))) {\n        return reply.code(409).send({ code: "REWARD_REQUIREMENT_NOT_MET" });\n      }\n    }`,
  `    const achievement = achievementById(requestedReward);\n    if (achievement && dependencies.achievementStore) {\n      const keyResult = idempotencyKey.safeParse(request.headers["idempotency-key"]);\n      if (!keyResult.success) return reply.code(400).send({ code: "INVALID_IDEMPOTENCY_KEY" });\n      const rate = authRateLimiter.consume(\`achievement-claim:\${playerId}\`, 20, 60_000);\n      if (!rate.allowed) return reply.header("retry-after", rate.retryAfterSeconds).code(429).send({ code: "RATE_LIMITED" });\n      try {\n        return await dependencies.achievementStore.claim({\n          playerId, achievementId: achievement.id, idempotencyKey: keyResult.data,\n        }, new Date());\n      } catch (error) {\n        if (error instanceof AchievementNotFoundError) return reply.code(404).send({ code: "REWARD_NOT_FOUND" });\n        if (error instanceof AchievementNotClaimableError) return reply.code(409).send({ code: "REWARD_REQUIREMENT_NOT_MET" });\n        if (error instanceof AchievementAlreadyClaimedError) return reply.code(409).send({ code: "REWARD_ALREADY_CLAIMED" });\n        if (error instanceof AchievementIdempotencyConflictError) return reply.code(409).send({ code: "IDEMPOTENCY_CONFLICT" });\n        if (error instanceof AchievementPlayerNotFoundError) return reply.code(404).send({ code: "PLAYER_NOT_FOUND" });\n        throw error;\n      }\n    }\n    const coins = achievement?.coins ?? rewardAmounts.get(requestedReward);\n    if (!coins) return reply.code(404).send({ code: "REWARD_NOT_FOUND" });\n    if (achievement) {\n      const profile = await dependencies.spinStore.getProfile(playerId);\n      if (!canClaimAchievement(achievement, profile.progression, new Set(profile.claimedRewards))) {\n        return reply.code(409).send({ code: "REWARD_REQUIREMENT_NOT_MET" });\n      }\n    }`,
);
await replaceOnce(
  httpApp,
  '  app.addHook("onClose", async () => {\n    await dependencies.spinStore.close();\n',
  '  app.addHook("onClose", async () => {\n    await dependencies.achievementStore?.close();\n    await dependencies.spinStore.close();\n',
);

const server = "apps/api/src/server.ts";
await replaceOnce(
  server,
  'import { PostgresOperationsStore } from "./operations/postgres-operations-store.js";\n',
  'import { PostgresOperationsStore } from "./operations/postgres-operations-store.js";\nimport { InMemoryAchievementStore } from "./achievements/in-memory-achievement-store.js";\nimport { PostgresAchievementStore } from "./achievements/postgres-achievement-store.js";\n',
);
await replaceOnce(
  server,
  'const spinStore = demoMode ? new InMemorySpinStore(8_400_000) : PostgresSpinStore.connect(databaseUrl!);\n',
  'const spinStore = demoMode ? new InMemorySpinStore(8_400_000) : PostgresSpinStore.connect(databaseUrl!);\nconst achievementStore = demoMode\n  ? new InMemoryAchievementStore(spinStore as InMemorySpinStore)\n  : PostgresAchievementStore.connect(databaseUrl!);\n',
);
await replaceOnce(
  server,
  '  authenticator: identityService,\n  spinStore,\n',
  '  authenticator: identityService,\n  spinStore,\n  achievementStore,\n',
);
