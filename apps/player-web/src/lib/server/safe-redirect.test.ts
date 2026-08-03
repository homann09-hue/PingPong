import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps an internal account continuation", () => {
    expect(safeRedirectPath("/account?recovery=1", "/account")).toBe("/account?recovery=1");
  });

  it.each([
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/%5C%5Cattacker.example",
    "account",
  ])("rejects external or ambiguous redirect %s", (candidate) => {
    expect(safeRedirectPath(candidate, "/account")).toBe("/account");
  });
});
