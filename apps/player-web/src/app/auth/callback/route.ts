import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account?connected=1";
  const origin = request.nextUrl.origin;
  if (!code) return NextResponse.redirect(`${origin}/account?error=missing_code`);
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? `${origin}/account?error=oauth_failed` : `${origin}${next}`);
  } catch {
    return NextResponse.redirect(`${origin}/account?error=auth_unavailable`);
  }
}
