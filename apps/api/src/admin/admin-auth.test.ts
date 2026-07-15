import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AdminJwtAuthenticator } from "./admin-auth.js";

const secret = "admin-test-secret-with-at-least-32-random-bytes";
const key = new TextEncoder().encode(secret);

describe("AdminJwtAuthenticator", () => {
  it("accepts only the dedicated workforce issuer, audience, and allow-listed roles", async () => {
    const authenticator = new AdminJwtAuthenticator(secret);
    const token = await new SignJWT({ roles: ["liveops_editor", "unknown_role"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("operator-42")
      .setIssuer("aurora-workforce")
      .setAudience("aurora-admin")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

    await expect(authenticator.authenticate(`Bearer ${token}`)).resolves.toEqual({
      subject: "operator-42",
      roles: ["liveops_editor"],
    });
  });

  it("rejects player-audience tokens", async () => {
    const authenticator = new AdminJwtAuthenticator(secret);
    const token = await new SignJWT({ roles: ["liveops_publisher"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("operator-42")
      .setIssuer("aurora-workforce")
      .setAudience("aurora-player")
      .setExpirationTime("5m")
      .sign(key);

    await expect(authenticator.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });
});
