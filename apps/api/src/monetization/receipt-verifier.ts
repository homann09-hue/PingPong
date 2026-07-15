import { z } from "zod";
import type { StorePlatform } from "./store-products.js";

export interface VerifyStorePurchaseCommand {
  readonly playerId: string;
  readonly platform: StorePlatform;
  readonly storeProductId: string;
  readonly transactionId: string;
  readonly verificationToken: string;
}

export interface VerifiedStoreTransaction {
  readonly platform: StorePlatform;
  readonly storeProductId: string;
  readonly transactionId: string;
  readonly originalTransactionId: string;
  readonly accountId: string;
  readonly environment: "production" | "sandbox";
  readonly purchasedAt: Date;
  readonly quantity: 1;
  readonly providerFinalized: boolean;
  readonly revokedAt: Date | null;
}

export interface ReceiptVerifier {
  verify(command: VerifyStorePurchaseCommand): Promise<VerifiedStoreTransaction>;
  close(): Promise<void>;
}

export class ReceiptInvalidError extends Error {}
export class ReceiptPendingError extends Error {}
export class ReceiptGatewayUnavailableError extends Error {}

const gatewayResponse = z.object({
  status: z.literal("verified"),
  platform: z.enum(["ios", "android"]),
  storeProductId: z.string().min(1).max(200), transactionId: z.string().min(1).max(256),
  originalTransactionId: z.string().min(1).max(256), accountId: z.string().uuid(),
  environment: z.enum(["production", "sandbox"]), purchasedAt: z.string().datetime(),
  quantity: z.literal(1), providerFinalized: z.boolean(), revokedAt: z.string().datetime().nullable(),
}).strict();

/** Delegates volatile App Store/Play APIs to a hardened internal verification gateway. */
export class HttpReceiptVerifier implements ReceiptVerifier {
  private readonly endpoint: URL;
  public constructor(endpoint: string, private readonly token: string) {
    this.endpoint = new URL(endpoint);
    if (this.endpoint.protocol !== "https:") throw new Error("STORE_VERIFICATION_URL must use HTTPS");
    if (Buffer.byteLength(token) < 32) throw new Error("STORE_GATEWAY_TOKEN must contain at least 32 bytes");
  }

  public async verify(command: VerifyStorePurchaseCommand): Promise<VerifiedStoreTransaction> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify(command), signal: AbortSignal.timeout(8_000),
      });
    } catch { throw new ReceiptGatewayUnavailableError(); }
    if (response.status === 202) { await response.body?.cancel(); throw new ReceiptPendingError(); }
    if (response.status === 400 || response.status === 404 || response.status === 409 || response.status === 422) {
      await response.body?.cancel(); throw new ReceiptInvalidError();
    }
    if (!response.ok) { await response.body?.cancel(); throw new ReceiptGatewayUnavailableError(); }
    const parsed = gatewayResponse.safeParse(await response.json());
    if (!parsed.success) throw new ReceiptGatewayUnavailableError();
    return {
      ...parsed.data, purchasedAt: new Date(parsed.data.purchasedAt),
      revokedAt: parsed.data.revokedAt ? new Date(parsed.data.revokedAt) : null,
    };
  }
  public async close(): Promise<void> {}
}

/** Explicit sandbox verifier for deterministic local development only. */
export class DemoReceiptVerifier implements ReceiptVerifier {
  public async verify(command: VerifyStorePurchaseCommand): Promise<VerifiedStoreTransaction> {
    if (command.verificationToken !== `demo-approved:${command.transactionId}`) throw new ReceiptInvalidError();
    return {
      platform: command.platform, storeProductId: command.storeProductId, transactionId: command.transactionId,
      originalTransactionId: command.transactionId, accountId: command.playerId, environment: "sandbox",
      purchasedAt: new Date(), quantity: 1, providerFinalized: true, revokedAt: null,
    };
  }
  public async close(): Promise<void> {}
}
