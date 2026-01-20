"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichFixturesWindow = enrichFixturesWindow;
// functions/src/features/enrichFixturesWindow.ts
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const teamStats_1 = require("../features/teamStats");
const client_1 = require("../sportmonks/client");
function numOrNull(v) {
    if (v == null)
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
/**
 * Extract final score without getFinalScore
 */
function extractFinalScore(scores) {
    if (!Array.isArray(scores))
        return null;
    const s = scores.find((x) => x?.description === "CURRENT" ||
        x?.description === "FT" ||
        x?.description === "AET");
    const home = s?.score?.home;
    const away = s?.score?.away;
    return typeof home === "number" && typeof away === "number"
        ? { home, away }
        : null;
}
/**
 * Fetch last N head-to-head matches using fixturesBetweenByTeam
 */
async function fetchH2H(homeTeamId, awayTeamId, token, count = 5) {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 365 * 3); // last 3 seasons
    const url = (0, client_1.fixturesBetweenByTeam)(homeTeamId, from.toISOString().slice(0, 10), today.toISOString().slice(0, 10), token, config_1.ENV.SPORTSMONKS.BASE_URL);
    const json = await (0, client_1.fetchJSON)(url);
    if (!Array.isArray(json?.data))
        return [];
    return json.data
        .filter((f) => (f?.state?.short_name === "FT" ||
        f?.state?.shortName === "FT" ||
        f?.state?.short_name === "AET" ||
        f?.state?.shortName === "AET") &&
        Array.isArray(f.participants) &&
        f.participants.some((p) => p?.id === awayTeamId))
        .sort((a, b) => Number(b.starting_at_timestamp ?? 0) -
        Number(a.starting_at_timestamp ?? 0))
        .slice(0, count)
        .map((f) => {
        const score = extractFinalScore(f.scores);
        if (!score)
            return null;
        const home = f.participants.find((p) => p?.meta?.location === "home");
        const away = f.participants.find((p) => p?.meta?.location === "away");
        return {
            homeName: home?.name ?? "Home",
            awayName: away?.name ?? "Away",
            homeGoals: score.home,
            awayGoals: score.away,
            startingAtTimestamp: f.starting_at_timestamp ??
                Math.floor(new Date(f.starting_at).getTime() / 1000),
        };
    })
        .filter(Boolean);
}
/**
 * Build ONE set of ML features (single version).
 * Full enrichment, single `features` map.
 */
function buildFeatures(fx, homeStats, awayStats) {
    const homeForm5 = homeStats?.form5 ?? {};
    const awayForm5 = awayStats?.form5 ?? {};
    const homeXg5 = homeStats?.xg5 ?? {};
    const awayXg5 = awayStats?.xg5 ?? {};
    const homeForm10 = homeStats?.form10 ?? {};
    const awayForm10 = awayStats?.form10 ?? {};
    const homeXg10 = homeStats?.xg10 ?? {};
    const awayXg10 = awayStats?.xg10 ?? {};
    const derived = {
        // gaps (5) - unweighted
        pointsGap5: homeForm5.pointsAvg5 != null && awayForm5.pointsAvg5 != null
            ? Number(homeForm5.pointsAvg5) - Number(awayForm5.pointsAvg5)
            : null,
        goalForGap5: homeForm5.goalsForAvg5 != null && awayForm5.goalsForAvg5 != null
            ? Number(homeForm5.goalsForAvg5) - Number(awayForm5.goalsForAvg5)
            : null,
        goalsAgainstGap5: homeForm5.goalsAgainstAvg5 != null && awayForm5.goalsAgainstAvg5 != null
            ? Number(homeForm5.goalsAgainstAvg5) -
                Number(awayForm5.goalsAgainstAvg5)
            : null,
        homeSample5: numOrNull(homeForm5.matches),
        awaySample5: numOrNull(awayForm5.matches),
        // tempo/script (xG) - unweighted
        expectedGoalsTotal5: homeXg5.xgForAvg5 != null && awayXg5.xgForAvg5 != null
            ? Number(homeXg5.xgForAvg5) + Number(awayXg5.xgForAvg5)
            : null,
        expectedGoalsAsym5: homeXg5.xgDiffAvg5 != null && awayXg5.xgDiffAvg5 != null
            ? Math.abs(Number(homeXg5.xgDiffAvg5) - Number(awayXg5.xgDiffAvg5))
            : null,
        expectedGoalsTotal10: homeXg10.xgForAvg10 != null && awayXg10.xgForAvg10 != null
            ? Number(homeXg10.xgForAvg10) + Number(awayXg10.xgForAvg10)
            : null,
        expectedGoalsAsym10: homeXg10.xgDiffAvg10 != null && awayXg10.xgDiffAvg10 != null
            ? Math.abs(Number(homeXg10.xgDiffAvg10) - Number(awayXg10.xgDiffAvg10))
            : null,
        // tempo/script (xG) - weighted
        expectedGoalsTotalW5: homeXg5.xgForWAvg5 != null && awayXg5.xgForWAvg5 != null
            ? Number(homeXg5.xgForWAvg5) + Number(awayXg5.xgForWAvg5)
            : null,
        expectedGoalsAsymW5: homeXg5.xgDiffWAvg5 != null && awayXg5.xgDiffWAvg5 != null
            ? Math.abs(Number(homeXg5.xgDiffWAvg5) - Number(awayXg5.xgDiffWAvg5))
            : null,
        expectedGoalsTotalW10: homeXg10.xgForWAvg10 != null && awayXg10.xgForWAvg10 != null
            ? Number(homeXg10.xgForWAvg10) + Number(awayXg10.xgForWAvg10)
            : null,
        expectedGoalsAsymW10: homeXg10.xgDiffWAvg10 != null && awayXg10.xgDiffWAvg10 != null
            ? Math.abs(Number(homeXg10.xgDiffWAvg10) - Number(awayXg10.xgDiffWAvg10))
            : null,
        // BTTS suppression (clean sheets + failed to score)
        bttsSuppress5: homeForm5.csRate5 != null &&
            awayForm5.csRate5 != null &&
            homeForm5.ftsRate5 != null &&
            awayForm5.ftsRate5 != null
            ? Math.max(Number(homeForm5.csRate5), Number(awayForm5.csRate5)) +
                Math.max(Number(homeForm5.ftsRate5), Number(awayForm5.ftsRate5))
            : null,
        bttsSuppress10: homeForm10.csRate10 != null &&
            awayForm10.csRate10 != null &&
            homeForm10.ftsRate10 != null &&
            awayForm10.ftsRate10 != null
            ? Math.max(Number(homeForm10.csRate10), Number(awayForm10.csRate10)) +
                Math.max(Number(homeForm10.ftsRate10), Number(awayForm10.ftsRate10))
            : null,
    };
    const features = {
        // table context
        home_position: numOrNull(fx.homePosition),
        away_position: numOrNull(fx.awayPosition),
        derived_positionGap: fx.homePosition != null && fx.awayPosition != null
            ? numOrNull(Number(fx.homePosition) - Number(fx.awayPosition))
            : null,
        // rest days
        home_restDays: numOrNull(homeStats?.restDays),
        away_restDays: numOrNull(awayStats?.restDays),
        derived_restGap: homeStats?.restDays != null && awayStats?.restDays != null
            ? numOrNull(Number(homeStats.restDays) - Number(awayStats.restDays))
            : null,
        // home form5 (unweighted)
        home_form5_matches: numOrNull(homeForm5.matches),
        home_form5_pointsAvg5: numOrNull(homeForm5.pointsAvg5),
        home_form5_goalsForAvg5: numOrNull(homeForm5.goalsForAvg5),
        home_form5_goalsAgainstAvg5: numOrNull(homeForm5.goalsAgainstAvg5),
        home_form5_winRate5: numOrNull(homeForm5.winRate5),
        home_form5_drawRate5: numOrNull(homeForm5.drawRate5),
        home_form5_lossRate5: numOrNull(homeForm5.lossRate5),
        home_form5_csRate5: numOrNull(homeForm5.csRate5),
        home_form5_ftsRate5: numOrNull(homeForm5.ftsRate5),
        // home form5 (weighted)
        home_form5_pointsWAvg5: numOrNull(homeForm5.pointsWAvg5),
        home_form5_goalsForWAvg5: numOrNull(homeForm5.goalsForWAvg5),
        home_form5_goalsAgainstWAvg5: numOrNull(homeForm5.goalsAgainstWAvg5),
        // away form5 (unweighted)
        away_form5_matches: numOrNull(awayForm5.matches),
        away_form5_pointsAvg5: numOrNull(awayForm5.pointsAvg5),
        away_form5_goalsForAvg5: numOrNull(awayForm5.goalsForAvg5),
        away_form5_goalsAgainstAvg5: numOrNull(awayForm5.goalsAgainstAvg5),
        away_form5_winRate5: numOrNull(awayForm5.winRate5),
        away_form5_drawRate5: numOrNull(awayForm5.drawRate5),
        away_form5_lossRate5: numOrNull(awayForm5.lossRate5),
        away_form5_csRate5: numOrNull(awayForm5.csRate5),
        away_form5_ftsRate5: numOrNull(awayForm5.ftsRate5),
        // away form5 (weighted)
        away_form5_pointsWAvg5: numOrNull(awayForm5.pointsWAvg5),
        away_form5_goalsForWAvg5: numOrNull(awayForm5.goalsForWAvg5),
        away_form5_goalsAgainstWAvg5: numOrNull(awayForm5.goalsAgainstWAvg5),
        // xg5 (unweighted)
        home_xg5_sampleSize: numOrNull(homeXg5.sampleSize),
        home_xg5_xgForAvg5: numOrNull(homeXg5.xgForAvg5),
        home_xg5_xgAgainstAvg5: numOrNull(homeXg5.xgAgainstAvg5),
        home_xg5_xgDiffAvg5: numOrNull(homeXg5.xgDiffAvg5),
        away_xg5_sampleSize: numOrNull(awayXg5.sampleSize),
        away_xg5_xgForAvg5: numOrNull(awayXg5.xgForAvg5),
        away_xg5_xgAgainstAvg5: numOrNull(awayXg5.xgAgainstAvg5),
        away_xg5_xgDiffAvg5: numOrNull(awayXg5.xgDiffAvg5),
        // xg5 (weighted)
        home_xg5_xgForWAvg5: numOrNull(homeXg5.xgForWAvg5),
        home_xg5_xgAgainstWAvg5: numOrNull(homeXg5.xgAgainstWAvg5),
        home_xg5_xgDiffWAvg5: numOrNull(homeXg5.xgDiffWAvg5),
        away_xg5_xgForWAvg5: numOrNull(awayXg5.xgForWAvg5),
        away_xg5_xgAgainstWAvg5: numOrNull(awayXg5.xgAgainstWAvg5),
        away_xg5_xgDiffWAvg5: numOrNull(awayXg5.xgDiffWAvg5),
        // form10 (unweighted)
        home_form10_matches: numOrNull(homeForm10.matches),
        home_form10_pointsAvg10: numOrNull(homeForm10.pointsAvg10),
        home_form10_goalsForAvg10: numOrNull(homeForm10.goalsForAvg10),
        home_form10_goalsAgainstAvg10: numOrNull(homeForm10.goalsAgainstAvg10),
        home_form10_winRate10: numOrNull(homeForm10.winRate10),
        home_form10_drawRate10: numOrNull(homeForm10.drawRate10),
        home_form10_lossRate10: numOrNull(homeForm10.lossRate10),
        home_form10_csRate10: numOrNull(homeForm10.csRate10),
        home_form10_ftsRate10: numOrNull(homeForm10.ftsRate10),
        away_form10_matches: numOrNull(awayForm10.matches),
        away_form10_pointsAvg10: numOrNull(awayForm10.pointsAvg10),
        away_form10_goalsForAvg10: numOrNull(awayForm10.goalsForAvg10),
        away_form10_goalsAgainstAvg10: numOrNull(awayForm10.goalsAgainstAvg10),
        away_form10_winRate10: numOrNull(awayForm10.winRate10),
        away_form10_drawRate10: numOrNull(awayForm10.drawRate10),
        away_form10_lossRate10: numOrNull(awayForm10.lossRate10),
        away_form10_csRate10: numOrNull(awayForm10.csRate10),
        away_form10_ftsRate10: numOrNull(awayForm10.ftsRate10),
        // form10 (weighted)
        home_form10_pointsWAvg10: numOrNull(homeForm10.pointsWAvg10),
        home_form10_goalsForWAvg10: numOrNull(homeForm10.goalsForWAvg10),
        home_form10_goalsAgainstWAvg10: numOrNull(homeForm10.goalsAgainstWAvg10),
        away_form10_pointsWAvg10: numOrNull(awayForm10.pointsWAvg10),
        away_form10_goalsForWAvg10: numOrNull(awayForm10.goalsForWAvg10),
        away_form10_goalsAgainstWAvg10: numOrNull(awayForm10.goalsAgainstWAvg10),
        // xg10 (unweighted)
        home_xg10_sampleSize: numOrNull(homeXg10.sampleSize),
        home_xg10_xgForAvg10: numOrNull(homeXg10.xgForAvg10),
        home_xg10_xgAgainstAvg10: numOrNull(homeXg10.xgAgainstAvg10),
        home_xg10_xgDiffAvg10: numOrNull(homeXg10.xgDiffAvg10),
        away_xg10_sampleSize: numOrNull(awayXg10.sampleSize),
        away_xg10_xgForAvg10: numOrNull(awayXg10.xgForAvg10),
        away_xg10_xgAgainstAvg10: numOrNull(awayXg10.xgAgainstAvg10),
        away_xg10_xgDiffAvg10: numOrNull(awayXg10.xgDiffAvg10),
        // xg10 (weighted)
        home_xg10_xgForWAvg10: numOrNull(homeXg10.xgForWAvg10),
        home_xg10_xgAgainstWAvg10: numOrNull(homeXg10.xgAgainstWAvg10),
        home_xg10_xgDiffWAvg10: numOrNull(homeXg10.xgDiffWAvg10),
        away_xg10_xgForWAvg10: numOrNull(awayXg10.xgForWAvg10),
        away_xg10_xgAgainstWAvg10: numOrNull(awayXg10.xgAgainstWAvg10),
        away_xg10_xgDiffWAvg10: numOrNull(awayXg10.xgDiffWAvg10),
        // derived
        derived_pointsGap5: numOrNull(derived.pointsGap5),
        derived_goalForGap5: numOrNull(derived.goalForGap5),
        derived_goalsAgainstGap5: numOrNull(derived.goalsAgainstGap5),
        derived_homeSample5: numOrNull(derived.homeSample5),
        derived_awaySample5: numOrNull(derived.awaySample5),
        derived_expectedGoalsTotal5: numOrNull(derived.expectedGoalsTotal5),
        derived_expectedGoalsAsym5: numOrNull(derived.expectedGoalsAsym5),
        derived_expectedGoalsTotal10: numOrNull(derived.expectedGoalsTotal10),
        derived_expectedGoalsAsym10: numOrNull(derived.expectedGoalsAsym10),
        // derived weighted tempo
        derived_expectedGoalsTotalW5: numOrNull(derived.expectedGoalsTotalW5),
        derived_expectedGoalsAsymW5: numOrNull(derived.expectedGoalsAsymW5),
        derived_expectedGoalsTotalW10: numOrNull(derived.expectedGoalsTotalW10),
        derived_expectedGoalsAsymW10: numOrNull(derived.expectedGoalsAsymW10),
        derived_bttsSuppress5: numOrNull(derived.bttsSuppress5),
        derived_bttsSuppress10: numOrNull(derived.bttsSuppress10),
    };
    const leagueId = fx?.leagueId ?? fx?.league_id;
    if (leagueId != null) {
        features[`lg_${String(leagueId)}`] = 1;
    }
    return { features, derived };
}
async function enrichFixturesWindow(token) {
    const db = admin.firestore();
    // Prefer inWindow fixtures
    const snap = await db
        .collection("fixtures_live")
        .where("inWindow", "==", true)
        .limit(config_1.ENV.FEATURES.ENRICH_LIMIT)
        .get();
    if (snap.empty) {
        console.log("enrichFixturesWindow: no inWindow fixtures");
        return;
    }
    const teamCache = new Map();
    const h2hCache = new Map();
    const getTeamStatsCached = async (id) => {
        if (!teamCache.has(id)) {
            teamCache.set(id, await (0, teamStats_1.computeTeamStats)(id, token));
        }
        return teamCache.get(id);
    };
    const getH2HCached = async (h, a) => {
        const key = `${Math.min(h, a)}-${Math.max(h, a)}`;
        if (!h2hCache.has(key)) {
            h2hCache.set(key, await fetchH2H(h, a, token));
        }
        return h2hCache.get(key);
    };
    let batch = db.batch();
    let ops = 0;
    let enriched = 0;
    let skippedMissingTeams = 0;
    for (const docSnap of snap.docs) {
        const fx = docSnap.data();
        const { homeTeamId, awayTeamId } = fx;
        if (!homeTeamId || !awayTeamId) {
            skippedMissingTeams++;
            continue;
        }
        const [homeStats, awayStats, h2h] = await Promise.all([
            getTeamStatsCached(homeTeamId),
            getTeamStatsCached(awayTeamId),
            getH2HCached(homeTeamId, awayTeamId),
        ]);
        const { features, derived } = buildFeatures(fx, homeStats, awayStats);
        // 1) Write ML features onto the fixture doc (single version)
        batch.set(docSnap.ref, {
            features,
            // optional debug (keep if useful)
            featuresRaw: {
                home: homeStats,
                away: awayStats,
                derived,
            },
            lastEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        ops++;
        enriched++;
        // 2) Write UI enrichment to separate doc (H2H, last5 strings, etc.)
        batch.set(db.collection("fixture_details").doc(docSnap.id), {
            fixtureId: docSnap.id,
            homeTeamId,
            awayTeamId,
            form: {
                homeLast5: homeStats.formLast5 ?? null,
                awayLast5: awayStats.formLast5 ?? null,
            },
            xg: {
                homeLast5For: homeStats.xgLast5For ?? null,
                homeLast5Against: homeStats.xgLast5Against ?? null,
                homeLast5ForAvg: homeStats.xgLast5ForAvg ?? null,
                homeLast5AgainstAvg: homeStats.xgLast5AgainstAvg ?? null,
                awayLast5For: awayStats.xgLast5For ?? null,
                awayLast5Against: awayStats.xgLast5Against ?? null,
                awayLast5ForAvg: awayStats.xgLast5ForAvg ?? null,
                awayLast5AgainstAvg: awayStats.xgLast5AgainstAvg ?? null,
            },
            h2h,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        ops++;
        if (ops >= 450) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0)
        await batch.commit();
    console.log(`enrichFixturesWindow: complete. enriched=${enriched}, skippedMissingTeams=${skippedMissingTeams}`);
}
//# sourceMappingURL=enrichFixturesWindow.js.map