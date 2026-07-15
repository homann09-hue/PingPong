import { buildApp } from "./app.js";
import { PostgresSpinStore } from "./spins/postgres-spin-store.js";
import { InMemorySpinStore } from "./spins/in-memory-spin-store.js";
import { IdentityService } from "./identity/identity-service.js";
import { InMemoryIdentityStore } from "./identity/in-memory-identity-store.js";
import { PostgresIdentityStore } from "./identity/postgres-identity-store.js";
import { InMemorySocialStore } from "./social/in-memory-social-store.js";
import { PostgresSocialStore } from "./social/postgres-social-store.js";
import { AdminJwtAuthenticator, DemoAdminAuthenticator } from "./admin/admin-auth.js";
import { InMemoryLiveOpsStore } from "./liveops/in-memory-liveops-store.js";
import { PostgresLiveOpsStore } from "./liveops/postgres-liveops-store.js";

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
const demoMode = process.env.DEMO_MODE === "true";
if (!demoMode && (!databaseUrl || !jwtSecret || !adminJwtSecret)) throw new Error("DATABASE_URL, JWT_SECRET and ADMIN_JWT_SECRET are required outside DEMO_MODE");
const demoPlayerId = "00000000-0000-4000-8000-000000000001";
const identityService = demoMode
  ? new IdentityService(new InMemoryIdentityStore(), "local-demo-jwt-secret-at-least-32-bytes")
  : new IdentityService(PostgresIdentityStore.connect(databaseUrl!), jwtSecret!);
const app = buildApp({
  authenticator: demoMode
    ? {
        authenticate: async (authorization) => authorization === "Bearer local-demo"
          ? demoPlayerId
          : identityService.authenticate(authorization),
      }
    : identityService,
  spinStore: demoMode ? new InMemorySpinStore(8_400_000) : PostgresSpinStore.connect(databaseUrl!),
  socialStore: demoMode ? new InMemorySocialStore(demoPlayerId) : PostgresSocialStore.connect(databaseUrl!),
  liveOpsStore: demoMode ? new InMemoryLiveOpsStore() : PostgresLiveOpsStore.connect(databaseUrl!),
  adminAuthenticator: demoMode ? new DemoAdminAuthenticator() : new AdminJwtAuthenticator(adminJwtSecret!),
  identityService,
});
try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
