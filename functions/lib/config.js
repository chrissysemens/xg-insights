"use strict";
/**
 * Centralised configuration for Cloud Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
exports.assertConfig = assertConfig;
exports.ENV = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    SPORTSMONKS: {
        BASE_URL: process.env.SPORTSMONKS_BASE ?? "https://api.sportmonks.com/v3/football",
    },
    PREDICTOR: {
        BASE_URL: process.env.PREDICTOR_BASE_URL,
        MODEL_VERSION: process.env.MODEL_VERSION ?? "epl-v1",
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
};
/**
 * Basic startup validation
 * Fail fast if critical config is missing.
 */
function assertConfig() {
    if (!exports.ENV.SPORTSMONKS.BASE_URL) {
        throw new Error("Missing SPORTSMONKS_BASE (base url) config");
    }
}
//# sourceMappingURL=config.js.map