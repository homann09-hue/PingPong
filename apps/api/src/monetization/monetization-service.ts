import { createHash } from "node:crypto";
import type { SpinStore, StorePurchaseSettlement, StoreRefundCommand } from "../spins/spin-store.js";
import { StorePurchaseRevokedError } from "../spins/spin-store.js";
import type { ReceiptVerifier, VerifyStorePurchaseCommand } from "./receipt-verifier.js";
import { ReceiptInvalidError } from "./receipt-verifier.js";
import { findStoreProduct, storeProducts, type StorePlatform } from "./store-products.js";

export interface PurchaseRequest {
  readonly platform: StorePlatform;
  readonly storeProductId: string;
  readonly transactionId: string;
  readonly verificationToken: string;
}

export interface RefundNotification {
  readonly eventId: string;
  readonly platform: StorePlatform;
  readonly transactionId: string;
  readonly occurredAt: Date;
  readonly providerPayloadHash: string;
}

/** Verifies provider state before crossing the authoritative wallet boundary. */
export class MonetizationService {
  public constructor(private readonly verifier: ReceiptVerifier, private readonly store: SpinStore) {}

  public catalog(platform: StorePlatform) {
    return storeProducts.map((product) => ({
      key: product.key, title: product.title, description: product.description, badge: product.badge,
      featured: product.featured, grantCoins: product.grantCoins, grantGems: product.grantGems,
      purchaseLimit: product.purchaseLimit, storeKind: product.storeKind, storeProductId: product.storeProductIds[platform],
    }));
  }

  public async verifyAndGrant(playerId: string, request: PurchaseRequest): Promise<StorePurchaseSettlement> {
    const product = findStoreProduct(request.platform, request.storeProductId);
    if (!product) throw new ReceiptInvalidError();
    const command: VerifyStorePurchaseCommand = { playerId, ...request };
    const verified = await this.verifier.verify(command);
    if (verified.platform !== request.platform || verified.storeProductId !== request.storeProductId
      || verified.transactionId !== request.transactionId || verified.accountId !== playerId
      || verified.quantity !== 1 || verified.purchaseState !== "purchased") throw new ReceiptInvalidError();
    if (verified.purchasedAt > new Date(Date.now() + 5 * 60_000)) throw new ReceiptInvalidError();
    if (verified.revokedAt) throw new StorePurchaseRevokedError();
    return this.store.grantStorePurchase({
      playerId, product, verified,
      verificationHash: createHash("sha256").update(request.verificationToken).digest("hex"),
    });
  }

  public async processRefund(notification: RefundNotification): Promise<boolean> {
    const command: StoreRefundCommand = notification;
    return this.store.refundStorePurchase(command);
  }

  public async close(): Promise<void> { await this.verifier.close(); }
}
