import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const cookieName = "aurora_lobby_state";

type LobbyState = {
  readonly streak: number;
  readonly lastVisit: string;
  readonly recentGames: readonly string[];
  readonly dismissedInbox: readonly string[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dayDistance(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 999;
  return Math.round((end - start) / 86_400_000);
}

function safeState(raw?: string): LobbyState {
  try {
    const parsed = raw ? JSON.parse(decodeURIComponent(raw)) as Partial<LobbyState> : {};
    return {
      streak: Math.max(1, Math.min(365, Number(parsed.streak) || 1)),
      lastVisit: typeof parsed.lastVisit === "string" ? parsed.lastVisit : today(),
      recentGames: Array.isArray(parsed.recentGames) ? parsed.recentGames.filter((value): value is string => typeof value === "string").slice(0, 8) : [],
      dismissedInbox: Array.isArray(parsed.dismissedInbox) ? parsed.dismissedInbox.filter((value): value is string => typeof value === "string").slice(0, 50) : [],
    };
  } catch {
    return { streak: 1, lastVisit: today(), recentGames: [], dismissedInbox: [] };
  }
}

function withVisit(state: LobbyState): LobbyState {
  const current = today();
  const distance = dayDistance(state.lastVisit, current);
  if (distance <= 0) return state;
  return {
    ...state,
    streak: distance === 1 ? Math.min(365, state.streak + 1) : 1,
    lastVisit: current,
  };
}

function responseFor(state: LobbyState) {
  const response = NextResponse.json(state, { headers: { "cache-control": "no-store" } });
  response.cookies.set(cookieName, encodeURIComponent(JSON.stringify(state)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return response;
}

export async function GET(request: NextRequest) {
  return responseFor(withVisit(safeState(request.cookies.get(cookieName)?.value)));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { slotId?: unknown; dismissInboxId?: unknown } | null;
  const state = withVisit(safeState(request.cookies.get(cookieName)?.value));
  const slotId = typeof body?.slotId === "string" ? body.slotId.trim() : "";
  const dismissInboxId = typeof body?.dismissInboxId === "string" ? body.dismissInboxId.trim() : "";
  const next: LobbyState = {
    ...state,
    recentGames: slotId ? [slotId, ...state.recentGames.filter((id) => id !== slotId)].slice(0, 8) : state.recentGames,
    dismissedInbox: dismissInboxId ? Array.from(new Set([...state.dismissedInbox, dismissInboxId])).slice(-50) : state.dismissedInbox,
  };
  return responseFor(next);
}
