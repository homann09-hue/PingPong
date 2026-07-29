import { describe, expect, it } from "vitest";
import { assertDemoModeAllowed } from "./runtime-environment.js";

describe("runtime environment", () => {
  it("rejects demo mode in generic and explicitly marked production environments", () => {
    expect(() => assertDemoModeAllowed(true, { NODE_ENV: "production" })).toThrow(
      "DEMO_MODE must not be enabled in a production environment",
    );
    expect(() => assertDemoModeAllowed(true, { APP_ENV: "prod", NODE_ENV: "development" })).toThrow(
      "DEMO_MODE must not be enabled in a production environment",
    );
    expect(() => assertDemoModeAllowed(true, {
      VERCEL_ENV: "production",
      APP_ENV: "staging",
      NODE_ENV: "production",
    })).toThrow("DEMO_MODE must not be enabled in a production environment");
  });

  it("allows explicit preview and staging deployments despite production build defaults", () => {
    expect(() => assertDemoModeAllowed(true, {
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    })).not.toThrow();
    expect(() => assertDemoModeAllowed(true, {
      APP_ENV: "staging",
      NODE_ENV: "production",
    })).not.toThrow();
  });

  it("allows local demo mode and never blocks a production configuration with demo mode disabled", () => {
    expect(() => assertDemoModeAllowed(true, {})).not.toThrow();
    expect(() => assertDemoModeAllowed(false, {
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    })).not.toThrow();
  });
});
