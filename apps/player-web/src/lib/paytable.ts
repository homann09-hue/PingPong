/**
 * Vom Server veroeffentlichte Gewinntabelle eines Slots.
 * Quelle: GET /v1/slots/:slotId/paytable (ueber das Player-BFF).
 */
export interface PaytableSymbol {
  readonly kind?: string;
  readonly payouts?: Readonly<Record<string, number>>;
}

export interface Paytable {
  readonly slotId?: string;
  readonly version?: number;
  readonly targetRtp: number;
  readonly volatility?: string;
  readonly paylines?: number;
  readonly maxWinMultiplier?: number;
  readonly betSteps?: readonly number[];
  readonly bonusBuyMultiplier?: number | null;
  readonly symbols?: Readonly<Record<string, PaytableSymbol>>;
}
