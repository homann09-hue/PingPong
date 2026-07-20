import { randomUUID } from "node:crypto";
import type { AccountSummary, ClientPlatform, CloudSave, CreateGuestSession, CreateProviderSession, DeviceSummary, IdentityProvider, IdentityStore, RotateSession, SessionRecord, SessionSummary } from "./identity-store.js";

interface MemorySession extends SessionRecord {
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly platform: ClientPlatform;
  readonly deviceId: string;
  readonly createdAt: Date;
  lastUsedAt: Date;
  revoked: boolean;
}

export class InMemoryIdentityStore implements IdentityStore {
  private readonly playersByInstallation = new Map<string, string>();
  private readonly playersByProvider = new Map<string, string>();
  private readonly providersByPlayer = new Map<string, Set<IdentityProvider>>();
  private readonly createdAtByPlayer = new Map<string, Date>();
  private readonly devices = new Map<string, { id: string; playerId: string; platform: ClientPlatform; createdAt: Date; lastSeenAt: Date }>();
  private readonly cloudSaves = new Map<string, CloudSave>();
  private readonly sessions = new Map<string, MemorySession>();
  private readonly deletedPlayers = new Set<string>();

  public async createGuestSession(command: CreateGuestSession): Promise<SessionRecord> {
    const playerId = this.playersByInstallation.get(command.installationId) ?? randomUUID();
    this.playersByInstallation.set(command.installationId, playerId);
    this.createdAtByPlayer.set(playerId, this.createdAtByPlayer.get(playerId) ?? new Date());
    this.providers(playerId).add("guest");
    return this.insert(playerId, command.installationId, command.refreshTokenHash, command.expiresAt, command.platform);
  }

  public async createProviderSession(command: CreateProviderSession): Promise<SessionRecord> {
    const providerKey = `${command.provider}:${command.providerSubject}`;
    const existingPlayerId = this.playersByProvider.get(providerKey);
    let playerId = existingPlayerId ?? command.currentPlayerId ?? randomUUID();
    if (command.currentPlayerId && existingPlayerId && existingPlayerId !== command.currentPlayerId) {
      const currentProviders = this.providersByPlayer.get(command.currentPlayerId) ?? new Set<IdentityProvider>();
      if ([...currentProviders].some((provider) => provider !== "guest")) throw new Error("IDENTITY_ALREADY_LINKED");
      this.deletedPlayers.add(command.currentPlayerId);
      await this.revokeAllSessions(command.currentPlayerId);
      for (const [installationId, mapped] of this.playersByInstallation) {
        if (mapped === command.currentPlayerId) this.playersByInstallation.delete(installationId);
      }
    }
    this.playersByProvider.set(providerKey, playerId);
    this.createdAtByPlayer.set(playerId, this.createdAtByPlayer.get(playerId) ?? new Date());
    this.providers(playerId).add(command.provider);
    this.providers(playerId).delete("guest");
    for (const [installationId, mapped] of this.playersByInstallation) {
      if (mapped === playerId) this.playersByInstallation.delete(installationId);
    }
    if (command.currentPlayerId === playerId) await this.revokeAllSessions(playerId);
    return this.insert(playerId, command.installationId, command.refreshTokenHash, command.expiresAt, command.platform);
  }

  public async rotateSession(command: RotateSession): Promise<SessionRecord | null> {
    const current = this.sessions.get(command.refreshTokenHash.toString("hex"));
    if (!current || current.revoked || current.expiresAt <= new Date()) {
      if (current) this.revokePlayer(current.playerId);
      return null;
    }
    current.revoked = true;
    current.lastUsedAt = new Date();
    return this.insert(current.playerId, current.deviceId, command.nextRefreshTokenHash, command.nextExpiresAt, current.platform, true);
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
        deviceId: session.deviceId,
        platform: session.platform,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      }));
  }

  public async listDevices(playerId: string): Promise<readonly DeviceSummary[]> {
    return [...this.devices.values()].filter((device) => device.playerId === playerId).map((device) => ({
      id: device.id, platform: device.platform, createdAt: device.createdAt.toISOString(), lastSeenAt: device.lastSeenAt.toISOString(),
      activeSessions: [...this.sessions.values()].filter((session) => session.playerId === playerId && session.deviceId === device.id && !session.revoked).length,
    }));
  }

  public async getAccount(playerId: string): Promise<AccountSummary | null> {
    if (this.deletedPlayers.has(playerId) || !this.createdAtByPlayer.has(playerId)) return null;
    const providers = [...this.providers(playerId)];
    return { playerId, status: "active", createdAt: this.createdAtByPlayer.get(playerId)!.toISOString(), providers,
      isGuest: providers.length === 1 && providers[0] === "guest", cloudSaveVersion: this.cloudSaves.get(playerId)?.version ?? 0 };
  }

  public async getCloudSave(playerId: string): Promise<CloudSave> {
    return this.cloudSaves.get(playerId) ?? { version: 0, updatedAt: this.createdAtByPlayer.get(playerId)?.toISOString() ?? new Date(0).toISOString(), data: {} };
  }

  public async updateCloudSave(playerId: string, expectedVersion: number, data: Readonly<Record<string, unknown>>): Promise<CloudSave | null> {
    const current = await this.getCloudSave(playerId);
    if (current.version !== expectedVersion) return null;
    const save = { version: expectedVersion + 1, updatedAt: new Date().toISOString(), data };
    this.cloudSaves.set(playerId, save);
    return save;
  }

  public async exportAccount(playerId: string): Promise<Readonly<Record<string, unknown>> | null> {
    const account = await this.getAccount(playerId);
    return account ? { exportedAt: new Date().toISOString(), account, devices: await this.listDevices(playerId), sessions: await this.listSessions(playerId), cloudSave: await this.getCloudSave(playerId) } : null;
  }

  public async deleteAccount(playerId: string): Promise<boolean> {
    if (this.deletedPlayers.has(playerId)) return false;
    this.deletedPlayers.add(playerId);
    for (const [key, mappedPlayerId] of this.playersByProvider) if (mappedPlayerId === playerId) this.playersByProvider.delete(key);
    this.providersByPlayer.delete(playerId);
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

  private insert(playerId: string, installationId: string, tokenHash: Buffer, expiresAt: Date, platform: ClientPlatform, existingDevice = false): SessionRecord {
    const now = new Date();
    const deviceId = existingDevice ? installationId : `${playerId}:${installationId}`;
    const previousDevice = this.devices.get(deviceId);
    this.devices.set(deviceId, { id: deviceId, playerId, platform, createdAt: previousDevice?.createdAt ?? now, lastSeenAt: now });
    const session: MemorySession = {
      playerId, sessionId: randomUUID(), tokenHash: tokenHash.toString("hex"), expiresAt,
      platform, deviceId, createdAt: now, lastUsedAt: now, revoked: false,
    };
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  private revokePlayer(playerId: string): void {
    for (const session of this.sessions.values()) if (session.playerId === playerId) session.revoked = true;
  }


  private providers(playerId: string): Set<IdentityProvider> {
    const existing = this.providersByPlayer.get(playerId);
    if (existing) return existing;
    const created = new Set<IdentityProvider>();
    this.providersByPlayer.set(playerId, created);
    return created;
  }
}
