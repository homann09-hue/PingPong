import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AdminJwtAuthenticator } from "./admin-auth.js";

const secret = "admin-test-secret-with-at-least-32-random-bytes";
const key = new TextEncoder().encode(secret);

function workforceToken(roles: readonly string[] = ["liveops_editor"]) {
  return new SignJWT({ roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("operator-42")
    .setIssuer("aurora-workforce")
    .setAudience("aurora-admin");
}

describe("AdminJwtAuthenticator", () => {
  it("accepts only the dedicated workforce issuer, audience, and allow-listed roles", async () => {
    const authenticator = new AdminJwtAuthenticator(secret);
    const token = await workforceToken(["liveops_editor", "social_moderator", "economy_approver", "operations_viewer", "unknown_role"])
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

    await expect(authenticator.authenticate(`Bearer ${token}`)).resolves.toEqual({
      subject: "operator-42",
      roles: ["liveops_editor", "social_moderator", "economy_approver", "operations_viewer"],
    });
  });

  it("rejects player-audience tokens", async () => {
    const authenticator = new AdminJwtAuthenticator(secret);
    const token = await new SignJWT({ roles: ["liveops_publisher"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("operator-42")
      .setIssuer("aurora-workforce")
      .setAudience("aurora-player")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

    await expect(authenticator.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("rejects workforce tokens without issued-at or expiration claims", async () => {
    const authenticator = new AdminJwtAuthenticator(secret);
    const token = await workforceToken().sign(key);

    await expect(authenticator.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("rejects workforce tokens whose lifetime exceeds fifteen minutes", async () => {
    const authenticator = new AdminJwtAuthenticator(secret);
    const token = await workforceToken()
      .setIssuedAt()
      .setExpirationTime("16m")
      .sign(key);

    await expect(authenticator.authenticate(`Bearer ${token}`)).resolves.toBeNull();
  });
});
