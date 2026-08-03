/** Accepts only a same-origin path and rejects URL-parser backslash ambiguities. */
export function safeRedirectPath(candidate: string | null, fallback: string): string {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")
    || candidate.includes("\\") || /%5c/iu.test(candidate)) return fallback;
  try {
    const parsed = new URL(candidate, "https://same-origin.invalid");
    return parsed.origin === "https://same-origin.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}
