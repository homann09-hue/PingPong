export type ClientPlatform = "ios" | "android" | "web";

export interface SessionRecord {
  readonly playerId: string;
  readonly sessionId: string;
}

export interface SessionSummary {
  readonly id: string;
  readonly platform: ClientPlatform;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
}

export interface CreateGuestSession {
  readonly installationId: string;
  readonly platform: ClientPlatform;
  readonly refreshTokenHash: Buffer;
  readonly expiresAt: Date;
  readonly initialCoinBalance: number;
}

export interface RotateSession {
  readonly refreshTokenHash: Buffer;
  readonly nextRefreshTokenHash: Buffer;
  readonly nextExpiresAt: Date;
}

export interface IdentityStore {
  createGuestSession(command: CreateGuestSession): Promise<SessionRecord>;
  rotateSession(command: RotateSession): Promise<SessionRecord | null>;
  revokeSession(refreshTokenHash: Buffer): Promise<void>;
  revokeSessionById(playerId: string, sessionId: string): Promise<boolean>;
  revokeAllSessions(playerId: string): Promise<number>;
  listSessions(playerId: string): Promise<readonly SessionSummary[]>;
  deleteAccount(playerId: string): Promise<boolean>;
  isSessionActive(sessionId: string, playerId: string): Promise<boolean>;
  close(): Promise<void>;
}
