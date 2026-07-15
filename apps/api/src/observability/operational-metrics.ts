/** Low-cardinality operational measurements; labels must never contain player IDs. */
export interface OperationalMetrics {
  observeHttp(method: string, route: string, statusCode: number, durationSeconds: number): void;
  recordSpin(slotId: string, outcome: "returned" | "rejected"): void;
  recordAnalytics(accepted: number, duplicates: number): void;
  recordPush(result: "delivered" | "retry" | "failed" | "suppressed" | "invalid_token"): void;
  snapshot(): OperationalMetricsSnapshot;
  render(): Promise<string>;
  readonly contentType: string;
}

export interface OperationalMetricsSnapshot {
  readonly requests: { readonly total: number; readonly serverErrors: number; readonly averageDurationMilliseconds: number };
  readonly spins: { readonly returned: number; readonly rejected: number };
  readonly analytics: { readonly accepted: number; readonly duplicates: number };
  readonly push: { readonly delivered: number; readonly retry: number; readonly failed: number; readonly suppressed: number; readonly invalidToken: number };
  readonly runtime: { readonly uptimeSeconds: number; readonly residentMemoryBytes: number; readonly heapUsedBytes: number };
}

interface RequestMetric { count: number; duration: number }

/** Dependency-free Prometheus text exporter with an intentionally fixed metric set. */
export class PrometheusOperationalMetrics implements OperationalMetrics {
  private readonly requests = new Map<string, RequestMetric>();
  private readonly spins = new Map<string, number>();
  private readonly analytics = new Map<string, number>();
  private readonly push = new Map<string, number>();
  public constructor(private readonly includeRuntimeMetrics = true) {}
  public readonly contentType = "text/plain; version=0.0.4; charset=utf-8";

  public observeHttp(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const key = JSON.stringify([method, route, String(statusCode)]);
    const metric = this.requests.get(key) ?? { count: 0, duration: 0 };
    metric.count += 1; metric.duration += durationSeconds; this.requests.set(key, metric);
  }
  public recordSpin(slotId: string, outcome: "returned" | "rejected"): void {
    const key = JSON.stringify([slotId, outcome]); this.spins.set(key, (this.spins.get(key) ?? 0) + 1);
  }
  public recordAnalytics(accepted: number, duplicates: number): void {
    if (accepted > 0) this.analytics.set("accepted", (this.analytics.get("accepted") ?? 0) + accepted);
    if (duplicates > 0) this.analytics.set("duplicate", (this.analytics.get("duplicate") ?? 0) + duplicates);
  }
  public recordPush(result: "delivered" | "retry" | "failed" | "suppressed" | "invalid_token"): void {
    this.push.set(result, (this.push.get(result) ?? 0) + 1);
  }
  public snapshot(): OperationalMetricsSnapshot {
    let total = 0; let serverErrors = 0; let duration = 0;
    for (const [key, metric] of this.requests) {
      const [, , status] = JSON.parse(key) as [string, string, string];
      total += metric.count; duration += metric.duration;
      if (Number(status) >= 500) serverErrors += metric.count;
    }
    let returned = 0; let rejected = 0;
    for (const [key, count] of this.spins) {
      const [, outcome] = JSON.parse(key) as [string, "returned" | "rejected"];
      if (outcome === "returned") returned += count; else rejected += count;
    }
    const memory = process.memoryUsage();
    return {
      requests: { total, serverErrors, averageDurationMilliseconds: total === 0 ? 0 : (duration / total) * 1_000 },
      spins: { returned, rejected },
      analytics: { accepted: this.analytics.get("accepted") ?? 0, duplicates: this.analytics.get("duplicate") ?? 0 },
      push: { delivered: this.push.get("delivered") ?? 0, retry: this.push.get("retry") ?? 0,
        failed: this.push.get("failed") ?? 0, suppressed: this.push.get("suppressed") ?? 0,
        invalidToken: this.push.get("invalid_token") ?? 0 },
      runtime: { uptimeSeconds: process.uptime(), residentMemoryBytes: memory.rss, heapUsedBytes: memory.heapUsed },
    };
  }
  public async render(): Promise<string> {
    const lines = [
      "# HELP aurora_http_requests_total Completed HTTP requests",
      "# TYPE aurora_http_requests_total counter",
    ];
    for (const [key, metric] of this.requests) {
      const [method, route, status] = JSON.parse(key) as [string, string, string]; const labels = labelSet({ method, route, status_code: status });
      lines.push(`aurora_http_requests_total${labels} ${metric.count}`);
    }
    lines.push("# HELP aurora_http_request_duration_seconds HTTP request duration", "# TYPE aurora_http_request_duration_seconds summary");
    for (const [key, metric] of this.requests) {
      const [method, route, status] = JSON.parse(key) as [string, string, string]; const labels = labelSet({ method, route, status_code: status });
      lines.push(`aurora_http_request_duration_seconds_sum${labels} ${metric.duration}`, `aurora_http_request_duration_seconds_count${labels} ${metric.count}`);
    }
    lines.push("# HELP aurora_spins_total Authoritative spin outcomes", "# TYPE aurora_spins_total counter");
    for (const [key, count] of this.spins) {
      const [slotId, outcome] = JSON.parse(key) as [string, string]; lines.push(`aurora_spins_total${labelSet({ slot_id: slotId, outcome })} ${count}`);
    }
    lines.push("# HELP aurora_client_analytics_events_total Client analytics ingestion results", "# TYPE aurora_client_analytics_events_total counter");
    for (const [result, count] of this.analytics) lines.push(`aurora_client_analytics_events_total${labelSet({ result })} ${count}`);
    lines.push("# HELP aurora_push_deliveries_total Push delivery outcomes", "# TYPE aurora_push_deliveries_total counter");
    for (const [result, count] of this.push) lines.push(`aurora_push_deliveries_total${labelSet({ result })} ${count}`);
    if (this.includeRuntimeMetrics) {
      const memory = process.memoryUsage();
      lines.push("# TYPE aurora_process_resident_memory_bytes gauge", `aurora_process_resident_memory_bytes ${memory.rss}`,
        "# TYPE aurora_process_heap_used_bytes gauge", `aurora_process_heap_used_bytes ${memory.heapUsed}`,
        "# TYPE aurora_process_uptime_seconds gauge", `aurora_process_uptime_seconds ${process.uptime()}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

function labelSet(labels: Readonly<Record<string, string>>): string {
  return `{${Object.entries(labels).map(([key, value]) => `${key}="${value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"')}"`).join(",")}}`;
}
