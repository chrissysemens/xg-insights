"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTeamStats = computeTeamStats;
// functions/src/features/teamStats.ts
const config_1 = require("../config");
const client_1 = require("../sportmonks/client");
const parsers_1 = require("../sportmonks/parsers");
const math_1 = require("../utils/math");
function weightedAvg(values, weights) {
    if (!values.length)
        return null;
    const w = weights.slice(0, values.length);
    const denom = w.reduce((a, b) => a + b, 0);
    if (!denom)
        return null;
    const num = values.reduce((sum, v, i) => sum + v * (w[i] ?? 0), 0);
    return num / denom;
}
// newest -> oldest (same direction as `finished` after sorting desc)
const W5 = [1.0, 0.85, 0.7, 0.55, 0.4];
const W10 = [1.0, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26];
// SportMonks can return xG include under different casing depending on client
function getXgFixtureArray(fx) {
    const a = fx?.xgfixture;
    if (Array.isArray(a))
        return a;
    const b = fx?.xgFixture;
    if (Array.isArray(b))
        return b;
    return [];
}
function extractTeamAndOppXg(xgArr, teamId) {
    if (!Array.isArray(xgArr) || xgArr.length < 2)
        return { teamXg: null, oppXg: null };
    const teamObj = xgArr.find((x) => x?.participant_id === teamId);
    const oppObj = xgArr.find((x) => x?.participant_id !== teamId);
    const teamXg = teamObj?.data?.value;
    const oppXg = oppObj?.data?.value;
    return {
        teamXg: typeof teamXg === "number" ? teamXg : null,
        oppXg: typeof oppXg === "number" ? oppXg : null,
    };
}
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
        .filter((f) => f?.state?.short_name === "FT" ||
        f?.state?.shortName === "FT" ||
        f?.state?.short_name === "AET" ||
        f?.state?.shortName === "AET")
        .sort((a, b) => new Date(b.starting_at ?? b.startingAt ?? 0).getTime() -
        new Date(a.starting_at ?? a.startingAt ?? 0).getTime());
    // --- Rest days ---
    const lastFinished = finished[0];
    const lastKickoff = lastFinished
        ? new Date(lastFinished.starting_at ?? lastFinished.startingAt ?? 0).getTime()
        : null;
    const restDays = lastKickoff != null
        ? Math.max(0, Math.floor((Date.now() - lastKickoff) / (1000 * 60 * 60 * 24)))
        : null;
    function computeLastNResults(n) {
        const matches = finished.slice(0, n);
        const out = [];
        for (const fx of matches) {
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
            out.push(gf > ga ? "W" : gf === ga ? "D" : "L");
        }
        return out;
    }
    function computeLastNXg(n) {
        const outFor = [];
        const outAgainst = [];
        for (const fx of finished) {
            const xgArr = getXgFixtureArray(fx);
            if (xgArr.length < 2)
                continue;
            const { teamXg, oppXg } = extractTeamAndOppXg(xgArr, teamId);
            if (teamXg != null && oppXg != null) {
                outFor.push(teamXg);
                outAgainst.push(oppXg);
            }
            if (outFor.length >= n)
                break;
        }
        return { xgFor: outFor, xgAgainst: outAgainst };
    }
    function computeFormN(n) {
        const slice = finished.slice(0, n);
        let wins = 0;
        let draws = 0;
        let losses = 0;
        let cleanSheets = 0;
        let failedToScore = 0;
        const goalsFor = [];
        const goalsAgainst = [];
        const points = [];
        let used = 0;
        for (const fx of slice) {
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
            used++;
            goalsFor.push(gf);
            goalsAgainst.push(ga);
            if (ga === 0)
                cleanSheets++;
            if (gf === 0)
                failedToScore++;
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
        const denom = used;
        const gfW = weightedAvg(goalsFor, n === 5 ? W5 : W10);
        const gaW = weightedAvg(goalsAgainst, n === 5 ? W5 : W10);
        const ptsW = weightedAvg(points, n === 5 ? W5 : W10);
        return {
            matches: denom,
            goalsForAvg: (0, math_1.avg)(goalsFor),
            goalsAgainstAvg: (0, math_1.avg)(goalsAgainst),
            pointsAvg: (0, math_1.avg)(points),
            winRate: (0, math_1.safeDivide)(wins, denom),
            drawRate: (0, math_1.safeDivide)(draws, denom),
            lossRate: (0, math_1.safeDivide)(losses, denom),
            csRate: (0, math_1.safeDivide)(cleanSheets, denom),
            ftsRate: (0, math_1.safeDivide)(failedToScore, denom),
            // weighted
            goalsForWAvg: gfW,
            goalsAgainstWAvg: gaW,
            pointsWAvg: ptsW,
        };
    }
    function computeXgN(n) {
        const slice = finished
            .filter((f) => getXgFixtureArray(f).length >= 2)
            .slice(0, n); // newest -> oldest
        const xgFor = [];
        const xgAgainst = [];
        for (const fx of slice) {
            const xgArr = getXgFixtureArray(fx);
            const { teamXg, oppXg } = extractTeamAndOppXg(xgArr, teamId);
            if (teamXg != null && oppXg != null) {
                xgFor.push(teamXg);
                xgAgainst.push(oppXg);
            }
        }
        const aFor = (0, math_1.avg)(xgFor);
        const aAgainst = (0, math_1.avg)(xgAgainst);
        const w = n === 5 ? W5 : W10;
        const wFor = weightedAvg(xgFor, w);
        const wAgainst = weightedAvg(xgAgainst, w);
        return {
            sampleSize: xgFor.length,
            // unweighted
            xgForAvg: aFor,
            xgAgainstAvg: aAgainst,
            xgDiffAvg: xgFor.length && xgAgainst.length ? (aFor ?? 0) - (aAgainst ?? 0) : null,
            // weighted
            xgForWAvg: wFor,
            xgAgainstWAvg: wAgainst,
            xgDiffWAvg: wFor != null && wAgainst != null
                ? Number(wFor) - Number(wAgainst)
                : null,
        };
    }
    const form5 = computeFormN(5);
    const xg5 = computeXgN(5);
    const form10 = computeFormN(10);
    const xg10 = computeXgN(10);
    const formLast5 = computeLastNResults(5);
    const xgLast5 = computeLastNXg(5);
    return {
        restDays,
        form5: {
            matches: form5.matches,
            goalsForAvg5: form5.goalsForAvg,
            goalsAgainstAvg5: form5.goalsAgainstAvg,
            pointsAvg5: form5.pointsAvg,
            winRate5: form5.winRate,
            drawRate5: form5.drawRate,
            lossRate5: form5.lossRate,
            csRate5: form5.csRate,
            ftsRate5: form5.ftsRate,
            // weighted
            goalsForWAvg5: form5.goalsForWAvg,
            goalsAgainstWAvg5: form5.goalsAgainstWAvg,
            pointsWAvg5: form5.pointsWAvg,
        },
        xg5: {
            sampleSize: xg5.sampleSize,
            // unweighted
            xgForAvg5: xg5.xgForAvg,
            xgAgainstAvg5: xg5.xgAgainstAvg,
            xgDiffAvg5: xg5.xgDiffAvg,
            // weighted
            xgForWAvg5: xg5.xgForWAvg,
            xgAgainstWAvg5: xg5.xgAgainstWAvg,
            xgDiffWAvg5: xg5.xgDiffWAvg,
        },
        form10: {
            matches: form10.matches,
            goalsForAvg10: form10.goalsForAvg,
            goalsAgainstAvg10: form10.goalsAgainstAvg,
            pointsAvg10: form10.pointsAvg,
            winRate10: form10.winRate,
            drawRate10: form10.drawRate,
            lossRate10: form10.lossRate,
            csRate10: form10.csRate,
            ftsRate10: form10.ftsRate,
            // weighted
            goalsForWAvg10: form10.goalsForWAvg,
            goalsAgainstWAvg10: form10.goalsAgainstWAvg,
            pointsWAvg10: form10.pointsWAvg,
        },
        xg10: {
            sampleSize: xg10.sampleSize,
            // unweighted
            xgForAvg10: xg10.xgForAvg,
            xgAgainstAvg10: xg10.xgAgainstAvg,
            xgDiffAvg10: xg10.xgDiffAvg,
            // weighted
            xgForWAvg10: xg10.xgForWAvg,
            xgAgainstWAvg10: xg10.xgAgainstWAvg,
            xgDiffWAvg10: xg10.xgDiffWAvg,
        },
        formLast5,
        xgLast5For: xgLast5.xgFor,
        xgLast5Against: xgLast5.xgAgainst,
        xgLast5ForAvg: (0, math_1.avg)(xgLast5.xgFor),
        xgLast5AgainstAvg: (0, math_1.avg)(xgLast5.xgAgainst),
    };
}
//# sourceMappingURL=teamStats.js.map