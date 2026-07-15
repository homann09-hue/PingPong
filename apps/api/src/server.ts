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
import { InMemoryAnalyticsStore } from "./analytics/in-memory-analytics-store.js";
import { PostgresAnalyticsStore } from "./analytics/postgres-analytics-store.js";
import { PrometheusOperationalMetrics } from "./observability/operational-metrics.js";
import { AlwaysReadyProbe, PostgresReadinessProbe } from "./observability/readiness.js";
import { InMemoryMessagingStore } from "./messaging/in-memory-messaging-store.js";
import { PostgresMessagingStore } from "./messaging/postgres-messaging-store.js";
import { AesGcmPushTokenCipher } from "./messaging/push-token-cipher.js";
import { DemoPushGateway, HttpPushGateway, PushDeliveryWorker } from "./messaging/push-delivery-worker.js";
import { DemoReceiptVerifier, HttpReceiptVerifier } from "./monetization/receipt-verifier.js";
import { MonetizationService } from "./monetization/monetization-service.js";

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
const metricsToken = process.env.METRICS_TOKEN;
const pushTokenEncryptionKey = process.env.PUSH_TOKEN_ENCRYPTION_KEY;
const pushGatewayUrl = process.env.PUSH_GATEWAY_URL;
const pushGatewayToken = process.env.PUSH_GATEWAY_TOKEN;
const storeVerificationUrl = process.env.STORE_VERIFICATION_URL;
const storeGatewayToken = process.env.STORE_GATEWAY_TOKEN;
const storeWebhookToken = process.env.STORE_WEBHOOK_TOKEN;
const demoMode = process.env.DEMO_MODE === "true";
if (!demoMode && (!databaseUrl || !jwtSecret || !adminJwtSecret || !metricsToken
  || !pushTokenEncryptionKey || !pushGatewayUrl || !pushGatewayToken || !storeVerificationUrl || !storeGatewayToken || !storeWebhookToken)) {
  throw new Error("Database, auth, metrics, push and store verification credentials are required outside DEMO_MODE");
}
if (!demoMode && Buffer.byteLength(metricsToken!) < 32) throw new Error("METRICS_TOKEN must contain at least 32 bytes");
if (!demoMode && Buffer.byteLength(storeWebhookToken!) < 32) throw new Error("STORE_WEBHOOK_TOKEN must contain at least 32 bytes");
const demoPlayerId = "00000000-0000-4000-8000-000000000001";
const identityService = demoMode
  ? new IdentityService(new InMemoryIdentityStore(), "local-demo-jwt-secret-at-least-32-bytes")
  : new IdentityService(PostgresIdentityStore.connect(databaseUrl!), jwtSecret!);
const messagingStore = demoMode
  ? new InMemoryMessagingStore()
  : PostgresMessagingStore.connect(databaseUrl!, new AesGcmPushTokenCipher(pushTokenEncryptionKey!));
const metrics = new PrometheusOperationalMetrics();
const spinStore = demoMode ? new InMemorySpinStore(8_400_000) : PostgresSpinStore.connect(databaseUrl!);
const monetizationService = new MonetizationService(
  demoMode ? new DemoReceiptVerifier() : new HttpReceiptVerifier(storeVerificationUrl!, storeGatewayToken!), spinStore,
);
const pushWorker = new PushDeliveryWorker(
  messagingStore,
  demoMode ? new DemoPushGateway() : new HttpPushGateway(pushGatewayUrl!, pushGatewayToken!),
  5_000,
  (error) => console.error("Push delivery worker failed", error),
  (result) => metrics.recordPush(result),
);
const app = buildApp({
  authenticator: identityService,
  spinStore,
  socialStore: demoMode ? new InMemorySocialStore(demoPlayerId) : PostgresSocialStore.connect(databaseUrl!),
  liveOpsStore: demoMode ? new InMemoryLiveOpsStore() : PostgresLiveOpsStore.connect(databaseUrl!),
  adminAuthenticator: demoMode ? new DemoAdminAuthenticator() : new AdminJwtAuthenticator(adminJwtSecret!),
  analyticsStore: demoMode ? new InMemoryAnalyticsStore() : PostgresAnalyticsStore.connect(databaseUrl!),
  metrics,
  metricsToken: demoMode ? "local-metrics" : metricsToken!,
  readiness: demoMode ? new AlwaysReadyProbe() : PostgresReadinessProbe.connect(databaseUrl!),
  messagingStore,
  pushWorker,
  identityService,
  monetizationService,
  storeWebhookToken: demoMode ? "local-store-webhook" : storeWebhookToken!,
});
try {
  await app.listen({ port, host });
  pushWorker.start();
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
