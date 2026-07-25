export type CelebrationKind = "reward" | "level-up" | "event-complete" | "jackpot";

export interface CelebrationDetail {
  readonly kind: CelebrationKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly amount?: number;
  readonly level?: number;
}

export function celebrate(detail: CelebrationDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CelebrationDetail>("aurora:celebrate", { detail }));
}
