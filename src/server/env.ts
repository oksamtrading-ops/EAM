const REQUIRED_PROD_KEYS = [
  "ANTHROPIC_API_KEY",
  "SHARE_COOKIE_SECRET",
  "CRON_SECRET",
] as const;

const WARN_PROD_KEYS = ["OPENAI_API_KEY"] as const;

let validated = false;

export function assertEnv(): void {
  if (validated) return;
  validated = true;
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_PROD_KEYS.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`FATAL: missing required env vars: ${missing.join(", ")}`);
  }

  for (const k of WARN_PROD_KEYS) {
    if (!process.env[k]) {
      console.error(
        JSON.stringify({
          evt: "env_warn",
          key: k,
          message: `${k} missing — degraded mode (semantic search disabled)`,
        })
      );
    }
  }
}

assertEnv();
