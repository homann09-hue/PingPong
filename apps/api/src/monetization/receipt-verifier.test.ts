import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpReceiptVerifier, ReceiptGatewayUnavailableError } from "./receipt-verifier.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const command = {
  playerId: "00000000-0000-4000-8000-000000000001",
  platform: "ios" as const,
  storeProductId: "aurora_coins",
  transactionId: "transaction-1",
  verificationToken: "receipt",
};

describe("HttpReceiptVerifier", () => {
  it.each([
    () => Promise.reject(new TypeError("network unavailable")),
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.resolve(new Response("not-json", { status: 200 })),
  ])("normalizes gateway and payload failures", async (fetchResult) => {
    vi.stubGlobal("fetch", vi.fn(fetchResult));
    const verifier = new HttpReceiptVerifier(
      "https://store-gateway.example/verify",
      "store-gateway-token-with-at-least-32-bytes",
    );
    await expect(verifier.verify(command)).rejects.toBeInstanceOf(ReceiptGatewayUnavailableError);
  });
});
