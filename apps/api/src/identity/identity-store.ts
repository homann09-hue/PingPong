export type ClientPlatform = "ios" | "android" | "web";
export type IdentityProvider = "guest" | "apple" | "google" | "email";

export interface SessionRecord {
  readonly playerId: string;
  readonly sessionId: string;
}

export interface SessionSummary {
  readonly id: string;
  readonly deviceId: string;
  readonly platform: ClientPlatform;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
}

export interface AccountSummary {
  readonly playerId: string;
  readonly status: "active" | "suspended" | "deleted";
  readonly createdAt: string;
  readonly providers: readonly IdentityProvider[];
  readonly isGuest: boolean;
  readonly cloudSaveVersion: number;
}

export interface DeviceSummary {
  readonly id: string;
  readonly platform: ClientPlatform;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly activeSessions: number;
}

export interface CloudSave {
  readonly version: number;
  readonly updatedAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface CreateProviderSession {
  readonly provider: Exclude<IdentityProvider, "guest">;
  readonly providerSubject: string;
  readonly currentPlayerId: string | null;
  readonly installationId: string;
  readonly platform: ClientPlatform;
  readonly refreshTokenHash: Buffer;
  readonly expiresAt: Date;
  readonly initialCoinBalance: number;
  readonly initialGemBalance: number;
}

export interface CreateGuestSession {
  readonly installationId: string;
  readonly platform: ClientPlatform;
  readonly refreshTokenHash: Buffer;
  readonly expiresAt: Date;
  readonly initialCoinBalance: number;
  readonly initialGemBalance: number;
}

export interface RotateSession {
  readonly refreshTokenHash: Buffer;
  readonly nextRefreshTokenHash: Buffer;
  readonly nextExpiresAt: Date;
}

export interface IdentityStore {
  createGuestSession(command: CreateGuestSession): Promise<SessionRecord>;
  createProviderSession(command: CreateProviderSession): Promise<SessionRecord>;
  rotateSession(command: RotateSession): Promise<SessionRecord | null>;
  revokeSession(refreshTokenHash: Buffer): Promise<void>;
  revokeSessionById(playerId: string, sessionId: string): Promise<boolean>;
  revokeAllSessions(playerId: string): Promise<number>;
  listSessions(playerId: string): Promise<readonly SessionSummary[]>;
  listDevices(playerId: string): Promise<readonly DeviceSummary[]>;
  getAccount(playerId: string): Promise<AccountSummary | null>;
  getCloudSave(playerId: string): Promise<CloudSave>;
  updateCloudSave(playerId: string, expectedVersion: number, data: Readonly<Record<string, unknown>>): Promise<CloudSave | null>;
  exportAccount(playerId: string): Promise<Readonly<Record<string, unknown>> | null>;
  deleteAccount(playerId: string): Promise<boolean>;
  isSessionActive(sessionId: string, playerId: string): Promise<boolean>;
  close(): Promise<void>;
}
