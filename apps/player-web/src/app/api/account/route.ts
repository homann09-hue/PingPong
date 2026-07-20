import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  accessCookie,
  clearTokenCookies,
  cookieOptions,
  installationCookie,
  issueTokens,
  playerApiUrl,
  refreshCookie,
  setTokenCookies,
  type Tokens,
} from "@/lib/server/player-proxy";

type AccountAction =
  | { readonly action: "exchange"; readonly provider: "apple" | "google" | "email"; readonly providerAccessToken: string }
  | { readonly action: "logout" | "logoutAll" | "delete" };

function isAccountAction(value: unknown): value is AccountAction {
  if (!value || typeof value !== "object" || !("action" in value)) return false;
  const action = (value as { action?: unknown }).action;
  if (action === "logout" || action === "logoutAll" || action === "delete") return true;
  const candidate = value as { action?: unknown; provider?: unknown; providerAccessToken?: unknown };
  return action === "exchange" && ["apple", "google", "email"].includes(String(candidate.provider))
    && typeof candidate.providerAccessToken === "string" && candidate.providerAccessToken.length >= 32;
}

/** Performs credential-sensitive account actions without exposing Aurora refresh tokens to browser code. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as unknown;
  if (!isAccountAction(body)) return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  const installationId = request.cookies.get(installationCookie)?.value;
  try {
    if (body.action === "exchange") {
      const current = await issueTokens(request);
      const response = await fetch(`${playerApiUrl}/v1/auth/provider`, {
        method: "POST",
        headers: { authorization: `Bearer ${current.tokens.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ provider: body.provider, providerAccessToken: body.providerAccessToken,
          installationId: current.installationId, platform: "web" }),
        cache: "no-store",
      });
      const payload = await response.text();
      const outgoing = new NextResponse(payload || null, { status: response.status,
        headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
      if (response.ok) setTokenCookies(outgoing, JSON.parse(payload) as Tokens, current.installationId);
      return outgoing;
    }

    const accessToken = request.cookies.get(accessCookie)?.value;
    const refreshToken = request.cookies.get(refreshCookie)?.value;
    let endpoint: string;
    let payload: Record<string, string> | undefined;
    if (body.action === "logout") {
      endpoint = "auth/logout";
      payload = refreshToken ? { refreshToken } : undefined;
    } else if (body.action === "logoutAll") endpoint = "auth/logout-all";
    else endpoint = "profile";
    if ((body.action === "logout" && !payload) || (body.action !== "logout" && !accessToken)) {
      const empty = NextResponse.json({ ok: true });
      clearTokenCookies(empty);
      return empty;
    }
    const response = await fetch(`${playerApiUrl}/v1/${endpoint}`, {
      method: body.action === "delete" ? "DELETE" : "POST",
      headers: { ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
    });
    const outgoing = response.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ code: "ACCOUNT_ACTION_FAILED" }, { status: response.status });
    clearTokenCookies(outgoing);
    if (installationId) outgoing.cookies.set(installationCookie, installationId, cookieOptions(365 * 24 * 60 * 60));
    return outgoing;
  } catch (error) {
    console.error("Account action failed", { action: body.action, error });
    return NextResponse.json({ code: "PLAYER_SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
