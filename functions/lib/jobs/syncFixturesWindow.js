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
exports.syncFixturesWindow = syncFixturesWindow;
const admin = __importStar(require("firebase-admin"));
const extractGoals_1 = require("../sportmonks/extractGoals");
const config_1 = require("../config");
// ✅ POSTPONED removed here because we hard-delete it instead of archiving
const FINISHED_STATES = new Set([
    "FT",
    "AET",
    "PEN",
    "DELETED",
    "ABANDONED",
    "CANCELED",
    "SUSPENDED",
]);
function isFinished(shortName) {
    if (!shortName)
        return false;
    return FINISHED_STATES.has(shortName);
}
function formatDateUTC(d) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function addDaysUTC(d, days) {
    const copy = new Date(d.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
}
function extractHomeAway(participants) {
    const home = participants.find((p) => p.meta?.location === "home");
    const away = participants.find((p) => p.meta?.location === "away");
    if (!home || !away)
        return null;
    return {
        home,
        away,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homePosition: home.meta?.position ?? null,
        awayPosition: away.meta?.position ?? null,
    };
}
function safeLeagueName(f) {
    // SportMonks league include typically gives league.name
    const n = f?.league?.name;
    if (typeof n === "string" && n.trim())
        return n.trim();
    // fallback: fixture name sometimes contains league, but keep it simple:
    return String(f.league_id);
}
/**
 * Sync fixtures for next N days into fixtures_live
 * Also maintains fixture_details/{fixtureId} (denormalised view doc)
 */
async function syncFixturesWindow(token) {
    const db = admin.firestore();
    const start = new Date();
    const end = addDaysUTC(start, config_1.ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS);
    const startStr = formatDateUTC(start);
    const endStr = formatDateUTC(end);
    // ✅ include league so we can persist league name for fixture details
    const include = "state;participants;odds;league;scores";
    let page = 1;
    let totalPages = 1;
    console.log(`Syncing fixtures between ${startStr} and ${endStr}...`);
    // In-run set to avoid upserting same team repeatedly
    const seenTeams = new Set();
    // ✅ Track which fixtures SportMonks actually returned this run
    const seenFixtureIds = new Set();
    // Exclude cup competitions
    const ALLOWED_LEAGUE_IDS = new Set([
        8, 9, 72, 82, 181, 208, 244, 271, 301, 384, 387, 444, 453, 462, 501, 564,
        567, 573, 591, 600,
    ]);
    while (page <= totalPages) {
        const url = `${config_1.ENV.SPORTSMONKS.BASE_URL}/fixtures/between/${startStr}/${endStr}` +
            `?api_token=${encodeURIComponent(token)}` +
            `&include=${encodeURIComponent(include)}` +
            `&page=${page}`;
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`SportMonks error ${res.status}: ${text.slice(0, 500)}`);
        }
        const json = await res.json();
        const fixtures = json?.data ?? [];
        totalPages = json?.meta?.pagination?.total_pages ?? 1;
        console.log(`Page ${page}/${totalPages}: ${fixtures.length} fixtures`);
        let batch = db.batch();
        let ops = 0;
        for (const f of fixtures) {
            // Filter leagues early
            if (!ALLOWED_LEAGUE_IDS.has(f.league_id))
                continue;
            const fixtureId = String(f.id);
            seenFixtureIds.add(fixtureId);
            const short = f.state?.short_name ?? undefined;
            const participants = f.participants ?? [];
            const mapped = extractHomeAway(participants);
            if (!mapped) {
                console.warn(`Fixture ${f.id} missing home/away participants; skipping`);
                continue;
            }
            // Upsert teams (once per run per team)
            for (const t of [mapped.home, mapped.away]) {
                if (seenTeams.has(t.id))
                    continue;
                seenTeams.add(t.id);
                const teamRef = db.collection("teams").doc(String(t.id));
                batch.set(teamRef, {
                    id: t.id,
                    name: t.name,
                    shortCode: t.short_code ?? null,
                    imagePath: t.image_path ?? null,
                    countryId: t.country_id ?? null,
                    founded: t.founded ?? null,
                    lastPlayedAt: t.last_played_at ?? null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                ops++;
                if (ops >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
            const startingAtISO = new Date(f.starting_at_timestamp * 1000).toISOString();
            // ✅ extract goals from scores (if present)
            const goals = (0, extractGoals_1.extractCurrentGoals)({
                participants: f.participants,
                scores: f.scores,
            });
            // Shared "league" block for both live + details docs
            const leagueName = safeLeagueName(f);
            const leagueBlock = {
                id: f.league_id,
                name: leagueName,
            };
            // Build fixture payload once (used by both live + archive)
            const fixturePayload = {
                id: f.id,
                leagueId: f.league_id,
                leagueName, // ✅ handy for list UI too
                seasonId: f.season_id,
                stageId: f.stage_id ?? null,
                roundId: f.round_id ?? null,
                stateId: f.state_id,
                venueId: f.venue_id ?? null,
                name: f.name,
                startingAt: startingAtISO,
                startingAtTimestamp: f.starting_at_timestamp,
                hasOdds: !!f.has_odds,
                hasPremiumOdds: !!f.has_premium_odds,
                homeTeamId: mapped.homeTeamId,
                awayTeamId: mapped.awayTeamId,
                homePosition: mapped.homePosition,
                awayPosition: mapped.awayPosition,
                state: f.state
                    ? {
                        id: f.state.id,
                        shortName: f.state.short_name ?? undefined,
                        name: f.state.name ?? undefined,
                    }
                    : null,
                oddsAvailable: Array.isArray(f.odds) && f.odds.length > 0,
                // Window markers
                inWindow: true,
                windowStart: startStr,
                windowEnd: endStr,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (goals) {
                fixturePayload.homeGoals = goals.homeGoals;
                fixturePayload.awayGoals = goals.awayGoals;
            }
            const liveRef = db.collection("fixtures_live").doc(fixtureId);
            const archRef = db.collection("fixtures_archive").doc(fixtureId);
            const predRef = db.collection("predictions_live").doc(fixtureId);
            const detailsRef = db.collection("fixture_details").doc(fixtureId);
            // --- POSTPONED RULE ---
            // remove from live + prediction + details
            if (short === "POSTPONED") {
                batch.delete(liveRef);
                batch.delete(predRef);
                batch.delete(detailsRef);
                ops += 3;
                continue;
            }
            // --- ARCHIVING RULE ---
            if (isFinished(short)) {
                batch.set(archRef, {
                    ...fixturePayload,
                    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    stateShortName: f.state?.short_name ?? null,
                    evaluationDone: false,
                }, { merge: true });
                // remove from live fixtures
                batch.delete(liveRef);
                // keep fixture_details (optional). For now we keep it so a user can still open it.
                batch.set(detailsRef, {
                    fixtureId,
                    startingAtTimestamp: f.starting_at_timestamp,
                    league: leagueBlock,
                    home: {
                        id: mapped.home.id,
                        name: mapped.home.name,
                        imagePath: mapped.home.image_path ?? null,
                    },
                    away: {
                        id: mapped.away.id,
                        name: mapped.away.name,
                        imagePath: mapped.away.image_path ?? null,
                    },
                    // You can optionally add final score for display
                    score: goals != null
                        ? { homeGoals: goals.homeGoals, awayGoals: goals.awayGoals }
                        : admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                ops += 3; // archive set + live delete + details upsert
            }
            else {
                // keep NS-only in fixtures_live (your current rule)
                if (short && short !== "NS")
                    continue;
                // fixtures_live
                batch.set(liveRef, fixturePayload, { merge: true });
                ops++;
                // fixture_details (view doc for details page)
                batch.set(detailsRef, {
                    fixtureId,
                    startingAtTimestamp: f.starting_at_timestamp,
                    league: leagueBlock,
                    home: {
                        id: mapped.home.id,
                        name: mapped.home.name,
                        imagePath: mapped.home.image_path ?? null,
                    },
                    away: {
                        id: mapped.away.id,
                        name: mapped.away.name,
                        imagePath: mapped.away.image_path ?? null,
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                ops++;
            }
            if (ops >= 450) {
                await batch.commit();
                batch = db.batch();
                ops = 0;
            }
        }
        if (ops > 0)
            await batch.commit();
        page++;
    }
    // ✅ PRUNE: delete live fixtures (and their predictions + details) that were previously in this window
    // but are no longer returned by SportMonks (common for postponed/rescheduled fixtures).
    {
        console.log(`Pruning fixtures_live for window ${startStr}..${endStr}...`);
        const liveSnap = await db
            .collection("fixtures_live")
            .where("inWindow", "==", true)
            .where("windowStart", "==", startStr)
            .where("windowEnd", "==", endStr)
            .get();
        let batch = db.batch();
        let ops = 0;
        let pruned = 0;
        for (const docSnap of liveSnap.docs) {
            if (!seenFixtureIds.has(docSnap.id)) {
                const predRef = db.collection("predictions_live").doc(docSnap.id);
                const detailsRef = db.collection("fixture_details").doc(docSnap.id);
                batch.delete(docSnap.ref); // fixtures_live/{fixtureId}
                batch.delete(predRef); // predictions_live/{fixtureId}
                batch.delete(detailsRef); // fixture_details/{fixtureId}
                pruned++;
                ops += 3;
                if (ops >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
        }
        if (ops > 0)
            await batch.commit();
        console.log(`Pruned ${pruned} stale fixtures (and predictions + details).`);
    }
    console.log("Fixture sync complete.");
}
//# sourceMappingURL=syncFixturesWindow.js.map