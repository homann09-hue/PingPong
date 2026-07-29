import type { IdentityProvider } from "./identity-store.js";

export type ExternalIdentityProvider = Exclude<IdentityProvider, "guest">;

export interface VerifiedExternalIdentity {
  readonly provider: ExternalIdentityProvider;
  readonly subject: string;
}

export interface ExternalIdentityVerifier {
  verify(accessToken: string, expectedProvider: ExternalIdentityProvider): Promise<VerifiedExternalIdentity | null>;
}

export class ExternalIdentityVerificationUnavailableError extends Error {
  public constructor() { super("External identity verification is unavailable"); }
}

interface SupabaseIdentity {
  readonly provider?: string;
}

interface SupabaseUser {
  readonly id?: string;
  readonly email_confirmed_at?: string | null;
  readonly identities?: readonly SupabaseIdentity[];
}

/** Verifies provider access tokens against Supabase Auth without using privileged service credentials. */
export class SupabaseIdentityVerifier implements ExternalIdentityVerifier {
  private readonly userEndpoint: string;

  public constructor(supabaseUrl: string, private readonly publishableKey: string) {
    this.userEndpoint = `${supabaseUrl.replace(/\/$/u, "")}/auth/v1/user`;
  }

  public async verify(accessToken: string, expectedProvider: ExternalIdentityProvider): Promise<VerifiedExternalIdentity | null> {
    let response: Response;
    try {
      response = await fetch(this.userEndpoint, {
        headers: { authorization: `Bearer ${accessToken}`, apikey: this.publishableKey },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ExternalIdentityVerificationUnavailableError();
    }
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel();
      throw new ExternalIdentityVerificationUnavailableError();
    }
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    let user: SupabaseUser;
    try {
      user = await response.json() as SupabaseUser;
    } catch {
      throw new ExternalIdentityVerificationUnavailableError();
    }
    if (!user.id || !user.identities?.some((identity) => identity.provider === expectedProvider)) return null;
    if (expectedProvider === "email" && !user.email_confirmed_at) return null;
    return { provider: expectedProvider, subject: user.id };
  }
}
