import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalIdentityVerificationUnavailableError, SupabaseIdentityVerifier } from "./external-identity-verifier.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SupabaseIdentityVerifier", () => {
  it("accepts a matching verified provider identity", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "provider-user",
      identities: [{ provider: "google" }],
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const verifier = new SupabaseIdentityVerifier("https://project.supabase.co", "publishable-key");
    await expect(verifier.verify("provider-token", "google")).resolves.toEqual({
      provider: "google",
      subject: "provider-user",
    });
  });

  it("treats rejected credentials as invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const verifier = new SupabaseIdentityVerifier("https://project.supabase.co", "publishable-key");
    await expect(verifier.verify("provider-token", "google")).resolves.toBeNull();
  });

  it.each([
    () => Promise.reject(new TypeError("network unavailable")),
    () => Promise.resolve(new Response(null, { status: 503 })),
    () => Promise.resolve(new Response("not-json", { status: 200 })),
  ])("reports provider outages instead of misclassifying credentials", async (fetchResult) => {
    vi.stubGlobal("fetch", vi.fn(fetchResult));
    const verifier = new SupabaseIdentityVerifier("https://project.supabase.co", "publishable-key");
    await expect(verifier.verify("provider-token", "google"))
      .rejects.toBeInstanceOf(ExternalIdentityVerificationUnavailableError);
  });
});
