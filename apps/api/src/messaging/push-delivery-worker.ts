import type { MessagingStore, PushCategory, PushDelivery } from "./messaging-store.js";

export type PushGatewayResult =
  | { readonly type: "delivered" }
  | { readonly type: "invalid_token"; readonly reason: string }
  | { readonly type: "retryable"; readonly reason: string; readonly retryAfterSeconds?: number }
  | { readonly type: "failed"; readonly reason: string };

export interface PushGateway { send(delivery: PushDelivery): Promise<PushGatewayResult> }

/** Normalized gateway adapter isolates product code from APNs/FCM/Web Push credentials. */
export class HttpPushGateway implements PushGateway {
  private readonly endpoint: URL;
  public constructor(endpoint: string, private readonly token: string) {
    this.endpoint = new URL(endpoint);
    if (this.endpoint.protocol !== "https:") throw new Error("PUSH_GATEWAY_URL must use HTTPS");
    if (Buffer.byteLength(token) < 32) throw new Error("PUSH_GATEWAY_TOKEN must contain at least 32 bytes");
  }

  public async send(delivery: PushDelivery): Promise<PushGatewayResult> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "idempotency-key": delivery.id,
        },
        body: JSON.stringify({
          provider: delivery.provider, token: delivery.token,
          notification: { title: delivery.title, body: delivery.body, deepLink: delivery.deepLink },
        }),
        signal: AbortSignal.timeout(5_000),
      });
      await response.body?.cancel();
      if (response.ok) return { type: "delivered" };
      if (response.status === 404 || response.status === 410) return { type: "invalid_token", reason: `gateway_${response.status}` };
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        return { type: "retryable", reason: `gateway_${response.status}`,
          ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: Math.min(retryAfter, 3_600) } : {}) };
      }
      return { type: "failed", reason: `gateway_${response.status}` };
    } catch (error) {
      return { type: "retryable", reason: error instanceof Error ? error.name : "gateway_network_error" };
    }
  }
}

export class DemoPushGateway implements PushGateway {
  public async send(_delivery: PushDelivery): Promise<PushGatewayResult> { return { type: "delivered" }; }
}

/** Leases durable deliveries, honors current consent/quiet hours and applies bounded retries. */
export class PushDeliveryWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  public constructor(
    private readonly store: MessagingStore,
    private readonly gateway: PushGateway,
    private readonly intervalMilliseconds = 5_000,
    private readonly onError: (error: unknown) => void = () => {},
    private readonly onResult: (result: "delivered" | "retry" | "failed" | "suppressed" | "invalid_token") => void = () => {},
  ) {}

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.runOnce().catch(this.onError); }, this.intervalMilliseconds);
    this.timer.unref();
    void this.runOnce().catch(this.onError);
  }

  public async runOnce(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const deliveries = await this.store.leaseDeliveries(100, now);
      await Promise.all(deliveries.map((delivery) => this.deliver(delivery, now)));
      return deliveries.length;
    } finally { this.running = false; }
  }

  public async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 5));
  }

  private async deliver(delivery: PushDelivery, now: Date): Promise<void> {
    if (!delivery.preferences.enabled || !categoryEnabled(delivery.category, delivery.preferences)) {
      await this.store.settleDelivery(delivery.id, { type: "suppressed", reason: "preference_disabled" }, now);
      this.onResult("suppressed"); return;
    }
    const quietUntil = nextAllowedAfterQuietHours(now, delivery.preferences.timeZone,
      delivery.preferences.quietHoursStartMinutes, delivery.preferences.quietHoursEndMinutes);
    if (quietUntil) {
      await this.store.settleDelivery(delivery.id, { type: "retry", reason: "quiet_hours", nextAttemptAt: quietUntil }, now);
      this.onResult("retry"); return;
    }
    const result = await this.gateway.send(delivery);
    if (result.type === "delivered") {
      await this.store.settleDelivery(delivery.id, { type: "delivered" }, now);
      this.onResult("delivered"); return;
    }
    if (result.type === "invalid_token") {
      await this.store.settleDelivery(delivery.id, { type: "invalid_token", reason: result.reason }, now);
      this.onResult("invalid_token"); return;
    }
    if (result.type === "failed" || delivery.attempt >= 5) {
      await this.store.settleDelivery(delivery.id, { type: "failed", reason: result.reason }, now);
      this.onResult("failed"); return;
    }
    const delaySeconds = result.retryAfterSeconds ?? Math.min(900, 5 * 2 ** Math.max(0, delivery.attempt - 1));
    await this.store.settleDelivery(delivery.id, {
      type: "retry", reason: result.reason, nextAttemptAt: new Date(now.getTime() + delaySeconds * 1_000),
    }, now);
    this.onResult("retry");
  }
}

function categoryEnabled(category: PushCategory, preferences: PushDelivery["preferences"]): boolean {
  if (category === "system") return true;
  return preferences[category];
}

export function nextAllowedAfterQuietHours(
  now: Date,
  timeZone: string,
  start: number | null,
  end: number | null,
): Date | null {
  if (start === null || end === null || !isQuiet(localMinute(now, timeZone), start, end)) return null;
  for (let offset = 1; offset <= 1_500; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 60_000);
    if (!isQuiet(localMinute(candidate, timeZone), start, end)) return candidate;
  }
  return new Date(now.getTime() + 24 * 60 * 60_000);
}

function isQuiet(minute: number, start: number, end: number): boolean {
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function localMinute(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("Invalid push preference time zone");
  return hour * 60 + minute;
}
