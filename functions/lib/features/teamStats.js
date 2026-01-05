"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTeamStats = computeTeamStats;
// functions/src/features/teamStats.ts
const config_1 = require("../config");
const client_1 = require("../sportmonks/client");
const parsers_1 = require("../sportmonks/parsers");
const math_1 = require("../utils/math");
/**
 * Rolling form + xG features for a team
 * IO: SportsMonks fetch
 */
async function computeTeamStats(teamId, token) {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - config_1.ENV.FEATURES.TEAM_HISTORY_DAYS);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = today.toISOString().slice(0, 10);
    const url = (0, client_1.fixturesBetweenByTeam)(teamId, fromStr, toStr, token, config_1.ENV.SPORTSMONKS.BASE_URL);
    const json = await (0, client_1.fetchJSON)(url);
    if (!Array.isArray(json?.data)) {
        throw new Error(`Unexpected SportsMonks response for team ${teamId}: data is not array`);
    }
    const finished = json.data
        .filter((f) => f?.state?.short_name === "FT" || f?.state?.shortName === "FT")
        .sort((a, b) => new Date(b.starting_at ?? b.startingAt ?? 0).getTime() -
        new Date(a.starting_at ?? a.startingAt ?? 0).getTime());
    // ---------- FORM (last N) ----------
    const formCount = config_1.ENV.FEATURES.FORM_MATCH_COUNT;
    const formMatches = finished.slice(0, formCount);
    let wins = 0;
    let draws = 0;
    let losses = 0;
    const goalsFor = [];
    const goalsAgainst = [];
    const points = [];
    for (const fx of formMatches) {
        const score = (0, parsers_1.getFinalScore)(fx.scores);
        if (!score)
            continue;
        const isHome = Array.isArray(fx.participants)
            ? fx.participants.some((p) => p?.id === teamId && p?.meta?.location === "home")
            : false;
        const gf = isHome ? score.home : score.away;
        const ga = isHome ? score.away : score.home;
        if (typeof gf !== "number" || typeof ga !== "number")
            continue;
        goalsFor.push(gf);
        goalsAgainst.push(ga);
        if (gf > ga) {
            wins++;
            points.push(3);
        }
        else if (gf === ga) {
            draws++;
            points.push(1);
        }
        else {
            losses++;
            points.push(0);
        }
    }
    const denomForm = formMatches.length || 0;
    const form5 = {
        matches: denomForm,
        goalsForAvg5: (0, math_1.avg)(goalsFor),
        goalsAgainstAvg5: (0, math_1.avg)(goalsAgainst),
        pointsAvg5: (0, math_1.avg)(points),
        winRate5: (0, math_1.safeDivide)(wins, denomForm),
        drawRate5: (0, math_1.safeDivide)(draws, denomForm),
        lossRate5: (0, math_1.safeDivide)(losses, denomForm),
    };
    // ---------- xG (last N with xG) ----------
    const xgCount = config_1.ENV.FEATURES.XG_MATCH_COUNT;
    const xgMatches = finished
        .filter((f) => Array.isArray(f?.xgfixture) && f.xgfixture.length >= 2)
        .slice(0, xgCount);
    const xgFor = [];
    const xgAgainst = [];
    for (const fx of xgMatches) {
        const teamXg = fx.xgfixture.find((x) => x?.participant_id === teamId)
            ?.data?.value;
        const oppXg = fx.xgfixture.find((x) => x?.participant_id !== teamId)
            ?.data?.value;
        if (typeof teamXg === "number" && typeof oppXg === "number") {
            xgFor.push(teamXg);
            xgAgainst.push(oppXg);
        }
    }
    const xg5 = {
        sampleSize: xgFor.length,
        xgForAvg5: (0, math_1.avg)(xgFor),
        xgAgainstAvg5: (0, math_1.avg)(xgAgainst),
        xgDiffAvg5: xgFor.length && xgAgainst.length ? (0, math_1.avg)(xgFor) - (0, math_1.avg)(xgAgainst) : null,
    };
    return { form5, xg5 };
}
//# sourceMappingURL=teamStats.js.map