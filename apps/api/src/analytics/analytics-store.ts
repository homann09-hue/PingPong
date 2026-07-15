export const analyticsEventNames = ["screen.viewed", "offer.impression", "slot.presentation_completed", "ui.error"] as const;
export type AnalyticsEventName = typeof analyticsEventNames[number];
export interface ClientAnalyticsEvent {
  readonly eventId: string; readonly name: AnalyticsEventName; readonly occurredAt: Date;
  readonly platform: "ios" | "android" | "web"; readonly appVersion: string;
  readonly screen?: string; readonly slotId?: string; readonly campaignId?: string;
}
export interface AnalyticsIngestResult { readonly accepted: number; readonly duplicates: number }
export interface AnalyticsStore {
  ingest(playerId: string, events: readonly ClientAnalyticsEvent[], receivedAt: Date): Promise<AnalyticsIngestResult>;
  close(): Promise<void>;
}
