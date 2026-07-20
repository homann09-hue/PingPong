import type { IdentityProvider } from "./identity-store.js";

export type ExternalIdentityProvider = Exclude<IdentityProvider, "guest">;

export interface VerifiedExternalIdentity {
  readonly provider: ExternalIdentityProvider;
  readonly subject: string;
}

export interface ExternalIdentityVerifier {
  verify(accessToken: string, expectedProvider: ExternalIdentityProvider): Promise<VerifiedExternalIdentity | null>;
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
    const response = await fetch(this.userEndpoint, {
      headers: { authorization: `Bearer ${accessToken}`, apikey: this.publishableKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const user = await response.json() as SupabaseUser;
    if (!user.id || !user.identities?.some((identity) => identity.provider === expectedProvider)) return null;
    if (expectedProvider === "email" && !user.email_confirmed_at) return null;
    return { provider: expectedProvider, subject: user.id };
  }
}
