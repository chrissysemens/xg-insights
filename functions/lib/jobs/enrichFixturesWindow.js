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
function numOrNull(v) {
    if (v == null)
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function buildFlatModelFeatures(fx, homeStats, awayStats) {
    // v1 sources (existing)
    const homeForm5 = homeStats?.form5 ?? {};
    const awayForm5 = awayStats?.form5 ?? {};
    // NEW
    const homeXg5 = homeStats?.xg5 ?? {};
    const awayXg5 = awayStats?.xg5 ?? {};
    const homeForm10 = homeStats?.form10 ?? {};
    const awayForm10 = awayStats?.form10 ?? {};
    const homeXg10 = homeStats?.xg10 ?? {};
    const awayXg10 = awayStats?.xg10 ?? {};
    const derived = {
        // existing
        pointsGap5: homeForm5.pointsAvg5 != null && awayForm5.pointsAvg5 != null
            ? Number(homeForm5.pointsAvg5) - Number(awayForm5.pointsAvg5)
            : null,
        goalForGap5: homeForm5.goalsForAvg5 != null && awayForm5.goalsForAvg5 != null
            ? Number(homeForm5.goalsForAvg5) - Number(awayForm5.goalsForAvg5)
            : null,
        goalsAgainstGap5: homeForm5.goalsAgainstAvg5 != null && awayForm5.goalsAgainstAvg5 != null
            ? Number(homeForm5.goalsAgainstAvg5) - Number(awayForm5.goalsAgainstAvg5)
            : null,
        homeSample5: numOrNull(homeForm5.matches),
        awaySample5: numOrNull(awayForm5.matches),
        // NEW: goal/tempo/script
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
        // NEW: BTTS suppression (clean sheets + failed to score)
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
    // -----------------------
    // V1 features (unchanged)
    // -----------------------
    const features = {
        // home
        home_form5_matches: numOrNull(homeForm5.matches),
        home_form5_pointsAvg5: numOrNull(homeForm5.pointsAvg5),
        home_form5_goalsForAvg5: numOrNull(homeForm5.goalsForAvg5),
        home_form5_goalsAgainstAvg5: numOrNull(homeForm5.goalsAgainstAvg5),
        home_form5_winRate5: numOrNull(homeForm5.winRate5),
        home_form5_drawRate5: numOrNull(homeForm5.drawRate5),
        home_form5_lossRate5: numOrNull(homeForm5.lossRate5),
        // away
        away_form5_matches: numOrNull(awayForm5.matches),
        away_form5_pointsAvg5: numOrNull(awayForm5.pointsAvg5),
        away_form5_goalsForAvg5: numOrNull(awayForm5.goalsForAvg5),
        away_form5_goalsAgainstAvg5: numOrNull(awayForm5.goalsAgainstAvg5),
        away_form5_winRate5: numOrNull(awayForm5.winRate5),
        away_form5_drawRate5: numOrNull(awayForm5.drawRate5),
        away_form5_lossRate5: numOrNull(awayForm5.lossRate5),
        // derived
        derived_pointsGap5: numOrNull(derived.pointsGap5),
        derived_goalForGap5: numOrNull(derived.goalForGap5),
        derived_goalsAgainstGap5: numOrNull(derived.goalsAgainstGap5),
        derived_homeSample5: numOrNull(derived.homeSample5),
        derived_awaySample5: numOrNull(derived.awaySample5),
    };
    // -----------------------
    // V2 features (new)
    // -----------------------
    const featuresV2 = {
        // Keep v1 signals too (good for continuity)
        ...features,
        // table context (cheap signal)
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
        // home xg5
        home_xg5_sampleSize: numOrNull(homeXg5.sampleSize),
        home_xg5_xgForAvg5: numOrNull(homeXg5.xgForAvg5),
        home_xg5_xgAgainstAvg5: numOrNull(homeXg5.xgAgainstAvg5),
        home_xg5_xgDiffAvg5: numOrNull(homeXg5.xgDiffAvg5),
        // away xg5
        away_xg5_sampleSize: numOrNull(awayXg5.sampleSize),
        away_xg5_xgForAvg5: numOrNull(awayXg5.xgForAvg5),
        away_xg5_xgAgainstAvg5: numOrNull(awayXg5.xgAgainstAvg5),
        away_xg5_xgDiffAvg5: numOrNull(awayXg5.xgDiffAvg5),
        // form10
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
        // xg10
        home_xg10_sampleSize: numOrNull(homeXg10.sampleSize),
        home_xg10_xgForAvg10: numOrNull(homeXg10.xgForAvg10),
        home_xg10_xgAgainstAvg10: numOrNull(homeXg10.xgAgainstAvg10),
        home_xg10_xgDiffAvg10: numOrNull(homeXg10.xgDiffAvg10),
        away_xg10_sampleSize: numOrNull(awayXg10.sampleSize),
        away_xg10_xgForAvg10: numOrNull(awayXg10.xgForAvg10),
        away_xg10_xgAgainstAvg10: numOrNull(awayXg10.xgAgainstAvg10),
        away_xg10_xgDiffAvg10: numOrNull(awayXg10.xgDiffAvg10),
        // derived: tempo/script
        derived_expectedGoalsTotal5: numOrNull(derived.expectedGoalsTotal5),
        derived_expectedGoalsAsym5: numOrNull(derived.expectedGoalsAsym5),
        derived_expectedGoalsTotal10: numOrNull(derived.expectedGoalsTotal10),
        derived_expectedGoalsAsym10: numOrNull(derived.expectedGoalsAsym10),
        // derived: btts suppression
        derived_bttsSuppress5: numOrNull(derived.bttsSuppress5),
        derived_bttsSuppress10: numOrNull(derived.bttsSuppress10),
    };
    // League one-hot: set current league to 1 (both maps)
    const leagueId = fx?.leagueId ?? fx?.league_id;
    if (leagueId != null) {
        const k = `lg_${String(leagueId)}`;
        features[k] = 1;
        featuresV2[k] = 1;
    }
    return { features, featuresV2, derived };
}
async function enrichFixturesWindow(token) {
    const db = admin.firestore();
    // 1) Prefer inWindow
    let snap = await db
        .collection("fixtures_live")
        .where("inWindow", "==", true)
        .limit(config_1.ENV.FEATURES.ENRICH_LIMIT)
        .get();
    // 2) Fallback: timestamp window
    if (snap.empty) {
        const nowTs = Math.floor(Date.now() / 1000);
        const endTs = nowTs + config_1.ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS * 24 * 60 * 60;
        snap = await db
            .collection("fixtures_live")
            .where("startingAtTimestamp", ">=", nowTs)
            .where("startingAtTimestamp", "<=", endTs)
            .limit(config_1.ENV.FEATURES.ENRICH_LIMIT)
            .get();
        console.log(`enrichFixturesWindow: inWindow empty, fallback timestamp query returned ${snap.size}`);
    }
    else {
        console.log(`enrichFixturesWindow: found ${snap.size} inWindow fixtures`);
    }
    if (snap.empty) {
        console.log("enrichFixturesWindow: no fixtures in window");
        return;
    }
    const teamCache = new Map();
    async function getTeamStatsCached(teamId) {
        const cached = teamCache.get(teamId);
        if (cached)
            return cached;
        const stats = await (0, teamStats_1.computeTeamStats)(teamId, token);
        teamCache.set(teamId, stats);
        return stats;
    }
    let batch = db.batch();
    let ops = 0;
    let enriched = 0;
    let skippedMissingTeams = 0;
    for (const doc of snap.docs) {
        const fx = doc.data();
        const homeTeamId = fx.homeTeamId;
        const awayTeamId = fx.awayTeamId;
        if (!homeTeamId || !awayTeamId) {
            skippedMissingTeams++;
            console.warn(`Fixture ${doc.id} missing homeTeamId/awayTeamId; skipping`);
            continue;
        }
        const [homeStats, awayStats] = await Promise.all([
            getTeamStatsCached(homeTeamId),
            getTeamStatsCached(awayTeamId),
        ]);
        const { features, featuresV2, derived } = buildFlatModelFeatures(fx, homeStats, awayStats);
        batch.set(doc.ref, {
            // v1 predictor map
            features,
            // v2 predictor map
            featuresV2,
            // optional debug
            featuresRaw: {
                home: homeStats,
                away: awayStats,
                derived,
            },
            lastEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        enriched++;
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