import { randomUUID } from "node:crypto";
import type { ClientPlatform, CreateGuestSession, IdentityStore, RotateSession, SessionRecord, SessionSummary } from "./identity-store.js";

interface MemorySession extends SessionRecord {
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly platform: ClientPlatform;
  readonly createdAt: Date;
  lastUsedAt: Date;
  revoked: boolean;
}

export class InMemoryIdentityStore implements IdentityStore {
  private readonly playersByInstallation = new Map<string, string>();
  private readonly sessions = new Map<string, MemorySession>();
  private readonly deletedPlayers = new Set<string>();

  public async createGuestSession(command: CreateGuestSession): Promise<SessionRecord> {
    const playerId = this.playersByInstallation.get(command.installationId) ?? randomUUID();
    this.playersByInstallation.set(command.installationId, playerId);
    return this.insert(playerId, command.refreshTokenHash, command.expiresAt, command.platform);
  }

  public async rotateSession(command: RotateSession): Promise<SessionRecord | null> {
    const current = this.sessions.get(command.refreshTokenHash.toString("hex"));
    if (!current || current.revoked || current.expiresAt <= new Date()) {
      if (current) this.revokePlayer(current.playerId);
      return null;
    }
    current.revoked = true;
    current.lastUsedAt = new Date();
    return this.insert(current.playerId, command.nextRefreshTokenHash, command.nextExpiresAt, current.platform);
  }

  public async revokeSession(refreshTokenHash: Buffer): Promise<void> {
    const session = this.sessions.get(refreshTokenHash.toString("hex"));
    if (session) session.revoked = true;
  }

  public async revokeSessionById(playerId: string, sessionId: string): Promise<boolean> {
    const session = [...this.sessions.values()].find((value) =>
      value.playerId === playerId && value.sessionId === sessionId && !value.revoked);
    if (!session) return false;
    session.revoked = true;
    return true;
  }

  public async revokeAllSessions(playerId: string): Promise<number> {
    let revoked = 0;
    for (const session of this.sessions.values()) {
      if (session.playerId === playerId && !session.revoked) { session.revoked = true; revoked++; }
    }
    return revoked;
  }

  public async listSessions(playerId: string): Promise<readonly SessionSummary[]> {
    return [...this.sessions.values()]
      .filter((session) => session.playerId === playerId && !session.revoked && session.expiresAt > new Date())
      .map((session) => ({
        id: session.sessionId,
        platform: session.platform,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      }));
  }

  public async deleteAccount(playerId: string): Promise<boolean> {
    if (this.deletedPlayers.has(playerId)) return false;
    this.deletedPlayers.add(playerId);
    for (const [installationId, mappedPlayerId] of this.playersByInstallation) {
      if (mappedPlayerId === playerId) this.playersByInstallation.delete(installationId);
    }
    await this.revokeAllSessions(playerId);
    return true;
  }

  public async isSessionActive(sessionId: string, playerId: string): Promise<boolean> {
    return !this.deletedPlayers.has(playerId) && [...this.sessions.values()].some((session) =>
      session.sessionId === sessionId && session.playerId === playerId && !session.revoked && session.expiresAt > new Date());
  }

  public async close(): Promise<void> {}

  private insert(playerId: string, tokenHash: Buffer, expiresAt: Date, platform: ClientPlatform): SessionRecord {
    const now = new Date();
    const session: MemorySession = {
      playerId, sessionId: randomUUID(), tokenHash: tokenHash.toString("hex"), expiresAt,
      platform, createdAt: now, lastUsedAt: now, revoked: false,
    };
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  private revokePlayer(playerId: string): void {
    for (const session of this.sessions.values()) if (session.playerId === playerId) session.revoked = true;
  }
}
