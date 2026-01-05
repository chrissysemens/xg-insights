/**
 * Centralised configuration for Cloud Functions
 */

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  SPORTSMONKS: {
    BASE_URL:
      process.env.SPORTSMONKS_BASE ?? "https://api.sportmonks.com/v3/football",
  },
  PREDICTOR: {
    BASE_URL: process.env.PREDICTOR_BASE_URL,
    MODEL_VERSION: process.env.MODEL_VERSION ?? "epl-v2",
  },

  APP: {
    REGION: "europe-west2",
    TIMEZONE: "Europe/London",
  },

  FEATURES: {
    FIXTURE_LOOKAHEAD_DAYS: 5,
    TEAM_HISTORY_DAYS: 60,
    FORM_MATCH_COUNT: 5,
    XG_MATCH_COUNT: 5,
    ENRICH_LIMIT: 200, // ✅ add this
  },
} as const;

/**
 * Basic startup validation
 * Fail fast if critical config is missing.
 */
export function assertConfig() {
  if (!ENV.SPORTSMONKS.BASE_URL) {
    throw new Error("Missing SPORTSMONKS_BASE (base url) config");
  }
}
