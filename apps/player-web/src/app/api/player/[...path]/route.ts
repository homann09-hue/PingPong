import type { NextRequest } from "next/server";
import { proxyPlayerRequest } from "@/lib/server/player-proxy";

interface Context { readonly params: Promise<{ readonly path: readonly string[] }> }

async function handler(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyPlayerRequest(request, path.join("/"));
}

export const GET = handler;
export const POST = handler;
