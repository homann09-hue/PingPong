interface WindowState { count: number; resetAt: number }

/** Process-local defense layer; production edge/Redis limits remain authoritative. */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  public consume(key: string, limit: number, windowMilliseconds: number, now = Date.now()): {
    readonly allowed: boolean; readonly remaining: number; readonly retryAfterSeconds: number;
  } {
    const existing = this.windows.get(key);
    const state = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMilliseconds }
      : existing;
    state.count++;
    this.windows.set(key, state);
    if (this.windows.size > 10_000) this.prune(now);
    return {
      allowed: state.count <= limit,
      remaining: Math.max(0, limit - state.count),
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1_000)),
    };
  }

  private prune(now: number): void {
    for (const [key, state] of this.windows) if (state.resetAt <= now) this.windows.delete(key);
  }
}
