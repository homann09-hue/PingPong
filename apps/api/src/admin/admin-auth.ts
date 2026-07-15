import { jwtVerify } from "jose";

export type AdminRole = "liveops_editor" | "liveops_publisher" | "liveops_auditor" | "social_moderator"
  | "economy_support" | "economy_approver" | "economy_auditor" | "operations_viewer";
export interface AdminPrincipal { readonly subject: string; readonly roles: readonly AdminRole[] }
export interface AdminAuthenticator { authenticate(authorization: string | undefined): Promise<AdminPrincipal | null> }

/** Verifies short-lived workforce tokens issued for the dedicated admin audience. */
export class AdminJwtAuthenticator implements AdminAuthenticator {
  private readonly key: Uint8Array;
  public constructor(secret: string) {
    if (Buffer.byteLength(secret) < 32) throw new Error("ADMIN_JWT_SECRET must contain at least 32 bytes");
    this.key = new TextEncoder().encode(secret);
  }
  public async authenticate(authorization: string | undefined): Promise<AdminPrincipal | null> {
    if (!authorization?.startsWith("Bearer ")) return null;
    try {
      const { payload } = await jwtVerify(authorization.slice(7), this.key, {
        algorithms: ["HS256"], issuer: "aurora-workforce", audience: "aurora-admin",
      });
      const allowed = new Set<AdminRole>(["liveops_editor", "liveops_publisher", "liveops_auditor", "social_moderator",
        "economy_support", "economy_approver", "economy_auditor", "operations_viewer"]);
      const roles = Array.isArray(payload.roles) ? payload.roles.filter((role): role is AdminRole =>
        typeof role === "string" && allowed.has(role as AdminRole)) : [];
      return typeof payload.sub === "string" && roles.length > 0 ? { subject: payload.sub, roles } : null;
    } catch { return null; }
  }
}

/** Explicit local-only workforce identities keep editor and publisher actors separate. */
export class DemoAdminAuthenticator implements AdminAuthenticator {
  public async authenticate(authorization: string | undefined): Promise<AdminPrincipal | null> {
    if (authorization === "Bearer local-admin-editor") {
      return { subject: "demo-editor", roles: ["liveops_editor", "liveops_auditor"] };
    }
    if (authorization === "Bearer local-admin-publisher") {
      return { subject: "demo-publisher", roles: ["liveops_publisher", "liveops_auditor"] };
    }
    if (authorization === "Bearer local-admin-moderator") {
      return { subject: "demo-moderator", roles: ["social_moderator"] };
    }
    if (authorization === "Bearer local-admin-support") {
      return { subject: "demo-support", roles: ["economy_support", "economy_auditor"] };
    }
    if (authorization === "Bearer local-admin-economy-approver") {
      return { subject: "demo-economy-approver", roles: ["economy_approver", "economy_auditor"] };
    }
    if (authorization === "Bearer local-admin-operations") {
      return { subject: "demo-operations", roles: ["operations_viewer"] };
    }
    return null;
  }
}
