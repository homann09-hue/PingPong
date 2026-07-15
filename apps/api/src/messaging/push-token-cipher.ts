import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface PushTokenCipher {
  encrypt(token: string): string;
  decrypt(envelope: string): string;
  fingerprint(token: string): string;
}

/** AES-256-GCM envelope encryption keeps provider credentials out of database plaintext. */
export class AesGcmPushTokenCipher implements PushTokenCipher {
  private readonly key: Buffer;

  public constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("PUSH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  public encrypt(token: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return ["v1", nonce.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  }

  public decrypt(envelope: string): string {
    const [version, nonce, encrypted, tag] = envelope.split(".");
    if (version !== "v1" || !nonce || !encrypted || !tag) throw new Error("Invalid push token envelope");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(nonce, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  }

  public fingerprint(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }
}

/** Test/demo cipher is deliberately unavailable to production composition. */
export class PlaintextPushTokenCipher implements PushTokenCipher {
  public encrypt(token: string): string { return `demo.${Buffer.from(token).toString("base64url")}`; }
  public decrypt(envelope: string): string {
    if (!envelope.startsWith("demo.")) throw new Error("Invalid demo push token envelope");
    return Buffer.from(envelope.slice(5), "base64url").toString("utf8");
  }
  public fingerprint(token: string): string { return createHash("sha256").update(token).digest("hex"); }
}
