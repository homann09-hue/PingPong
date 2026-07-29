type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Prevents fixed demo credentials and permissive demo networking from being
 * enabled in a production deployment. Provider-specific environment markers
 * take precedence over generic Node defaults so preview builds can still run
 * with NODE_ENV=production.
 */
export function assertDemoModeAllowed(
  demoMode: boolean,
  environment: RuntimeEnvironment = process.env,
): void {
  if (!demoMode) return;
  const deploymentEnvironment = normalized(environment.VERCEL_ENV)
    ?? normalized(environment.APP_ENV)
    ?? normalized(environment.NODE_ENV);
  if (deploymentEnvironment === "production" || deploymentEnvironment === "prod") {
    throw new Error("DEMO_MODE must not be enabled in a production environment");
  }
}

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim().toLowerCase();
  return result || undefined;
}
