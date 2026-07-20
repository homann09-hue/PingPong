import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { Authenticator } from "../auth.js";
import type { ExternalIdentityProvider, ExternalIdentityVerifier } from "./external-identity-verifier.js";
import type { AccountSummary, ClientPlatform, CloudSave, DeviceSummary, IdentityStore, SessionRecord, SessionSummary } from "./identity-store.js";

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;

export interface SessionTokens {
  readonly tokenType: "Bearer";
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
  readonly playerId: string;
}

export class ExternalIdentityUnavailableError extends Error {
  public constructor() { super("External identity provider is not configured"); }
}
export class ExternalIdentityInvalidError extends Error {
  public constructor() { super("External identity token is invalid"); }
}

/** Issues short-lived access tokens and one-time rotating opaque refresh tokens. */
export class IdentityService implements Authenticator {
  private readonly key: Uint8Array;

  public constructor(
    private readonly store: IdentityStore,
    secret: string,
    private readonly externalIdentityVerifier?: ExternalIdentityVerifier,
  ) {
    if (Buffer.byteLength(secret) < 32) throw new Error("JWT_SECRET must contain at least 32 bytes");
    this.key = new TextEncoder().encode(secret);
  }

  public async signInWithProvider(command: {
    readonly provider: ExternalIdentityProvider;
    readonly providerAccessToken: string;
    readonly currentPlayerId: string | null;
    readonly installationId: string;
    readonly platform: ClientPlatform;
  }): Promise<SessionTokens> {
    if (!this.externalIdentityVerifier) throw new ExternalIdentityUnavailableError();
    const identity = await this.externalIdentityVerifier.verify(command.providerAccessToken, command.provider);
    if (!identity) throw new ExternalIdentityInvalidError();
    const refreshToken = this.newRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MILLISECONDS);
    const session = await this.store.createProviderSession({
      provider: identity.provider,
      providerSubject: identity.subject,
      currentPlayerId: command.currentPlayerId,
      installationId: command.installationId,
      platform: command.platform,
      refreshTokenHash: this.hash(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      initialCoinBalance: 100_000,
      initialGemBalance: 320,
    });
    return this.tokens(session, refreshToken, refreshTokenExpiresAt);
  }

  public async createGuest(installationId: string, platform: ClientPlatform): Promise<SessionTokens> {
    const refreshToken = this.newRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MILLISECONDS);
    const session = await this.store.createGuestSession({
      installationId,
      platform,
      refreshTokenHash: this.hash(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      initialCoinBalance: 100_000,
      initialGemBalance: 320,
    });
    return this.tokens(session, refreshToken, refreshTokenExpiresAt);
  }

  public async refresh(refreshToken: string): Promise<SessionTokens | null> {
    const nextRefreshToken = this.newRefreshToken();
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MILLISECONDS);
    const session = await this.store.rotateSession({
      refreshTokenHash: this.hash(refreshToken),
      nextRefreshTokenHash: this.hash(nextRefreshToken),
      nextExpiresAt,
    });
    return session ? this.tokens(session, nextRefreshToken, nextExpiresAt) : null;
  }

  public async logout(refreshToken: string): Promise<void> {
    await this.store.revokeSession(this.hash(refreshToken));
  }

  public async listSessions(playerId: string): Promise<readonly SessionSummary[]> {
    return this.store.listSessions(playerId);
  }

  public async listDevices(playerId: string): Promise<readonly DeviceSummary[]> { return this.store.listDevices(playerId); }
  public async getAccount(playerId: string): Promise<AccountSummary | null> { return this.store.getAccount(playerId); }
  public async getCloudSave(playerId: string): Promise<CloudSave> { return this.store.getCloudSave(playerId); }
  public async updateCloudSave(
    playerId: string,
    expectedVersion: number,
    data: Readonly<Record<string, unknown>>,
  ): Promise<CloudSave | null> { return this.store.updateCloudSave(playerId, expectedVersion, data); }
  public async exportAccount(playerId: string): Promise<Readonly<Record<string, unknown>> | null> {
    return this.store.exportAccount(playerId);
  }

  public async revokeSession(playerId: string, sessionId: string): Promise<boolean> {
    return this.store.revokeSessionById(playerId, sessionId);
  }

  public async logoutAll(playerId: string): Promise<number> {
    return this.store.revokeAllSessions(playerId);
  }

  public async deleteAccount(playerId: string): Promise<boolean> {
    return this.store.deleteAccount(playerId);
  }

  public async authenticate(authorization: string | undefined): Promise<string | null> {
    if (!authorization?.startsWith("Bearer ")) return null;
    try {
      const { payload } = await jwtVerify(authorization.slice(7), this.key, {
        algorithms: ["HS256"], issuer: "aurora-identity", audience: "aurora-api",
      });
      if (payload.typ !== "access" || typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
      return await this.store.isSessionActive(payload.sid, payload.sub) ? payload.sub : null;
    } catch {
      return null;
    }
  }

  public async close(): Promise<void> { await this.store.close(); }

  private async tokens(session: SessionRecord, refreshToken: string, refreshTokenExpiresAt: Date): Promise<SessionTokens> {
    const accessToken = await new SignJWT({ typ: "access", sid: session.sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(session.playerId)
      .setIssuer("aurora-identity")
      .setAudience("aurora-api")
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
      .sign(this.key);
    return {
      tokenType: "Bearer",
      accessToken,
      accessTokenExpiresIn: ACCESS_TOKEN_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
      playerId: session.playerId,
    };
  }

  private newRefreshToken(): string { return randomBytes(32).toString("base64url"); }
  private hash(token: string): Buffer { return createHash("sha256").update(token, "utf8").digest(); }
}
