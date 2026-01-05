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
const config_1 = require("../config");
const FINISHED_STATES = new Set(["FT", "AET", "PEN"]); // expand if SportMonks uses others in your data
// If you see additional “finished” codes in your logs, add them here.
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
/**
 * Sync fixtures for next N days into fixtures_live
 * Token is passed in (so index.ts can provide secrets)
 */
async function syncFixturesWindow(token) {
    const db = admin.firestore();
    const start = new Date();
    const end = addDaysUTC(start, config_1.ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS);
    const startStr = formatDateUTC(start);
    const endStr = formatDateUTC(end);
    const include = "state;participants;odds;league"; // add league if you want UI metadata
    let page = 1;
    let totalPages = 1;
    console.log(`Syncing fixtures between ${startStr} and ${endStr}...`);
    // In-run set to avoid upserting same team repeatedly
    const seenTeams = new Set();
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
            // Build fixture payload once (used by both live + archive)
            const fixturePayload = {
                id: f.id,
                leagueId: f.league_id,
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
                // Window markers (useful for pruning/debug)
                inWindow: true,
                windowStart: startStr,
                windowEnd: endStr,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const liveRef = db.collection("fixtures_live").doc(String(f.id));
            // --- ARCHIVING RULE ---
            // If fixture is finished, move to fixtures_archive and remove from fixtures_live.
            // Otherwise, keep in fixtures_live.
            if (isFinished(short)) {
                const archRef = db.collection("fixtures_archive").doc(String(f.id));
                batch.set(archRef, {
                    ...fixturePayload,
                    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                batch.delete(liveRef);
                // Optional: also remove any live predictions (uncomment if desired)
                // batch.delete(db.collection("predictions_live").doc(String(f.id)));
                ops += 2; // one set + one delete
            }
            else {
                // Keep only not-started fixtures in live if you still want that behaviour:
                // (Your old code skipped anything not NS.)
                // If you'd like to also keep LIVE/HT/etc in fixtures_live, remove this guard.
                if (short && short !== "NS") {
                    continue;
                }
                batch.set(liveRef, fixturePayload, { merge: true });
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
    console.log("Fixture sync complete.");
}
//# sourceMappingURL=syncFixturesWindow.js.map