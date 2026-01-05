"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinalScore = getFinalScore;
exports.extractTeamIds = extractTeamIds;
function getFinalScore(scores) {
    const home = scores.find(s => s.description === "CURRENT" && s.score.participant === "home")?.score.goals;
    const away = scores.find(s => s.description === "CURRENT" && s.score.participant === "away")?.score.goals;
    if (typeof home !== "number" || typeof away !== "number")
        return null;
    return { home, away };
}
function extractTeamIds(fixture) {
    const homeTeamId = fixture.participants?.find((p) => p.meta?.location === "home")?.id;
    const awayTeamId = fixture.participants?.find((p) => p.meta?.location === "away")?.id;
    return { homeTeamId, awayTeamId };
}
//# sourceMappingURL=parsers.js.map