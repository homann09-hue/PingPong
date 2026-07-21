import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const accessCookie = "aurora_web_access";
export const refreshCookie = "aurora_web_refresh";
export const installationCookie = "aurora_web_installation";
export const playerApiUrl = process.env.AURORA_API_URL ?? "http://127.0.0.1:8080";

export interface Tokens {
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
}

const allowedRoutes = [
  /^lobby$/,
  /^profile$/,
  /^wallet$/,
  /^jackpots$/,
  /^events$/,
  /^missions$/,
  /^missions\/[a-z0-9-]+\/claim$/,
  /^rewards\/(hourly|daily)$/,
  /^rewards\/(hourly|daily)\/claim$/,
  /^rewards\/[a-z0-9-]+\/claims$/,
  // Boost-Center: Sammelmarken, Booster, Loyalitaetstausch und High Roller Club.
  /^economy\/check-win$/,
  /^economy\/check-win\/claim$/,
  /^economy\/boosters$/,
  /^economy\/boosters\/(craft|activate)$/,
  /^economy\/loyalty-rewards$/,
  /^economy\/loyalty-rewards\/[a-z0-9-]+\/redeem$/,
  /^economy\/high-roller-club$/,
  /^economy\/high-roller-club\/activate$/,
  /^auth\/(account|sessions|devices|cloud-save|privacy-export|logout-all)$/,
  /^auth\/sessions\/[0-9a-f-]{36}$/,
  /^slots\/availability$/,
  /^slots\/[a-z0-9-]+\/paytable$/,
  /^slots\/[a-z0-9-]+\/spins$/,
];

export function isAllowedPlayerPath(path: string): boolean {
  return allowedRoutes.some((pattern) => pattern.test(path));
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export function setTokenCookies(response: NextResponse, tokens: Tokens, installationId: string): void {
  response.cookies.set(accessCookie, tokens.accessToken, cookieOptions(tokens.accessTokenExpiresIn));
  response.cookies.set(refreshCookie, tokens.refreshToken, cookieOptions(30 * 24 * 60 * 60));
  response.cookies.set(installationCookie, installationId, cookieOptions(365 * 24 * 60 * 60));
}

export function clearTokenCookies(response: NextResponse): void {
  response.cookies.set(accessCookie, "", cookieOptions(0));
  response.cookies.set(refreshCookie, "", cookieOptions(0));
}

export async function issueTokens(request: NextRequest): Promise<{ tokens: Tokens; installationId: string }> {
  const installationId = request.cookies.get(installationCookie)?.value ?? randomUUID();
  const currentRefresh = request.cookies.get(refreshCookie)?.value;
  if (currentRefresh) {
    const refreshed = await fetch(`${playerApiUrl}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: currentRefresh }),
      cache: "no-store",
    });
    if (refreshed.ok) return { tokens: await refreshed.json() as Tokens, installationId };
  }
  const created = await fetch(`${playerApiUrl}/v1/auth/guest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ installationId, platform: "web" }),
    cache: "no-store",
  });
  if (!created.ok) throw new Error(`Identity service returned ${created.status}`);
  return { tokens: await created.json() as Tokens, installationId };
}

async function upstreamRequest(request: NextRequest, path: string, accessToken: string, body: string | undefined): Promise<Response> {
  const headers = new Headers({ authorization: `Bearer ${accessToken}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const needsIdempotencyKey = request.method === "POST"
    && (path.endsWith("/spins") || path.endsWith("/claim") || path.endsWith("/claims")
      || path.endsWith("/craft") || path.endsWith("/activate") || path.endsWith("/redeem"));
  if (needsIdempotencyKey) {
    headers.set("idempotency-key", request.headers.get("idempotency-key") ?? randomUUID());
  }
  return fetch(`${playerApiUrl}/v1/${path}`, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });
}

/** Same-origin player BFF. It keeps platform bearer credentials out of browser JavaScript. */
export async function proxyPlayerRequest(request: NextRequest, path: string): Promise<NextResponse> {
  if (!isAllowedPlayerPath(path)) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  try {
    let accessToken = request.cookies.get(accessCookie)?.value;
    const requestBody = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
    let replacement: { tokens: Tokens; installationId: string } | undefined;
    if (!accessToken) {
      replacement = await issueTokens(request);
      accessToken = replacement.tokens.accessToken;
    }
    let response = await upstreamRequest(request, path, accessToken, requestBody);
    if (response.status === 401) {
      replacement = await issueTokens(request);
      response = await upstreamRequest(request, path, replacement.tokens.accessToken, requestBody);
    }
    const body = await response.text();
    const outgoing = new NextResponse(body || null, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
    if (replacement) {
      setTokenCookies(outgoing, replacement.tokens, replacement.installationId);
    }
    outgoing.headers.set("cache-control", "private, no-store");
    return outgoing;
  } catch (error) {
    console.error("Player BFF request failed", { path, error });
    return NextResponse.json({ code: "PLAYER_SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
