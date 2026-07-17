import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const accessCookie = "aurora_web_access";
const refreshCookie = "aurora_web_refresh";
const installationCookie = "aurora_web_installation";
const upstream = process.env.AURORA_API_URL ?? "http://127.0.0.1:8080";

interface Tokens {
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
  /^slots\/[a-z0-9-]+\/paytable$/,
  /^slots\/[a-z0-9-]+\/spins$/,
];

export function isAllowedPlayerPath(path: string): boolean {
  return allowedRoutes.some((pattern) => pattern.test(path));
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

async function issueTokens(request: NextRequest): Promise<{ tokens: Tokens; installationId: string }> {
  const installationId = request.cookies.get(installationCookie)?.value ?? randomUUID();
  const currentRefresh = request.cookies.get(refreshCookie)?.value;
  if (currentRefresh) {
    const refreshed = await fetch(`${upstream}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: currentRefresh }),
      cache: "no-store",
    });
    if (refreshed.ok) return { tokens: await refreshed.json() as Tokens, installationId };
  }
  const created = await fetch(`${upstream}/v1/auth/guest`, {
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
  if (request.method === "POST" && path.endsWith("/spins")) {
    headers.set("idempotency-key", request.headers.get("idempotency-key") ?? randomUUID());
  }
  return fetch(`${upstream}/v1/${path}`, {
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
      outgoing.cookies.set(accessCookie, replacement.tokens.accessToken, cookieOptions(replacement.tokens.accessTokenExpiresIn));
      outgoing.cookies.set(refreshCookie, replacement.tokens.refreshToken, cookieOptions(30 * 24 * 60 * 60));
      outgoing.cookies.set(installationCookie, replacement.installationId, cookieOptions(365 * 24 * 60 * 60));
    }
    outgoing.headers.set("cache-control", "private, no-store");
    return outgoing;
  } catch (error) {
    console.error("Player BFF request failed", { path, error });
    return NextResponse.json({ code: "PLAYER_SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
