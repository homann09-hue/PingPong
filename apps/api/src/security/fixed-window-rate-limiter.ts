interface WindowState { count: number; resetAt: number }

/** Process-local defense layer; production edge/Redis limits remain authoritative. */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  public constructor(private readonly maxEntries = 10_000) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
  }

  public consume(key: string, limit: number, windowMilliseconds: number, now = Date.now()): {
    readonly allowed: boolean; readonly remaining: number; readonly retryAfterSeconds: number;
  } {
    const existing = this.windows.get(key);
    if (existing?.resetAt !== undefined && existing.resetAt <= now) this.windows.delete(key);
    if (!this.windows.has(key) && this.windows.size >= this.maxEntries) {
      this.prune(now);
      while (this.windows.size >= this.maxEntries) {
        const oldest = this.windows.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.windows.delete(oldest);
      }
    }
    const state = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMilliseconds }
      : existing;
    state.count++;
    this.windows.set(key, state);
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
