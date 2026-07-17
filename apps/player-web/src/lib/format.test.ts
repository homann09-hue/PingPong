import { describe, expect, it } from "vitest";
import { coinNumber, compactNumber } from "./format";

describe("wallet formatting", () => {
  it("keeps exact coin balances readable", () => expect(coinNumber(8_399_900)).toBe("8,399,900"));
  it("compacts lobby jackpot values", () => expect(compactNumber(72_450_000)).toBe("72.5M"));
});
