// Vitest setup — load env vars so tests mirror dev/prod behaviour.
// Intentionally a no-op import if dotenv isn't available; CI / .env.local
// already populate process.env in most cases.
import "dotenv/config";
