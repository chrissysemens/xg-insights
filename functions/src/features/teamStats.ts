// functions/src/features/teamStats.ts
import { ENV } from "../config";
import { fixturesBetweenByTeam, fetchJSON } from "../sportmonks/client";
import { getFinalScore } from "../sportmonks/parsers";
import { avg, safeDivide } from "../utils/math";

/**
 * Rolling form + xG features for a team.
 * Adds:
 * - form10 / xg10
 * - clean sheet + failed-to-score rates (for BTTS suppression)
 * - restDays (days since last finished match)
 */
export async function computeTeamStats(teamId: number, token: string) {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - ENV.FEATURES.TEAM_HISTORY_DAYS);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = today.toISOString().slice(0, 10);

  const url = fixturesBetweenByTeam(
    teamId,
    fromStr,
    toStr,
    token,
    ENV.SPORTSMONKS.BASE_URL
  );

  const json = await fetchJSON(url);
  if (!Array.isArray(json?.data)) {
    throw new Error(
      `Unexpected SportsMonks response for team ${teamId}: data is not array`
    );
  }

  const finished = json.data
    .filter(
      (f: any) =>
        f?.state?.short_name === "FT" ||
        f?.state?.shortName === "FT" ||
        f?.state?.short_name === "AET" ||
        f?.state?.shortName === "AET"
    )
    .sort(
      (a: any, b: any) =>
        new Date(b.starting_at ?? b.startingAt ?? 0).getTime() -
        new Date(a.starting_at ?? a.startingAt ?? 0).getTime()
    );

  // --- Rest days (since most recent finished match) ---
  const lastFinished = finished[0];
  const lastKickoff = lastFinished
    ? new Date(lastFinished.starting_at ?? lastFinished.startingAt ?? 0).getTime()
    : null;
  const restDays =
    lastKickoff != null
      ? Math.max(
          0,
          Math.round((Date.now() - lastKickoff) / (1000 * 60 * 60 * 24))
        )
      : null;

  function computeFormN(n: number) {
    const matches = finished.slice(0, n);

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let cleanSheets = 0;
    let failedToScore = 0;

    const goalsFor: number[] = [];
    const goalsAgainst: number[] = [];
    const points: number[] = [];

    for (const fx of matches) {
      const score = getFinalScore(fx.scores);
      if (!score) continue;

      const isHome = Array.isArray(fx.participants)
        ? fx.participants.some(
            (p: any) => p?.id === teamId && p?.meta?.location === "home"
          )
        : false;

      const gf = isHome ? score.home : score.away;
      const ga = isHome ? score.away : score.home;

      if (typeof gf !== "number" || typeof ga !== "number") continue;

      goalsFor.push(gf);
      goalsAgainst.push(ga);

      if (ga === 0) cleanSheets++;
      if (gf === 0) failedToScore++;

      if (gf > ga) {
        wins++;
        points.push(3);
      } else if (gf === ga) {
        draws++;
        points.push(1);
      } else {
        losses++;
        points.push(0);
      }
    }

    const denom = matches.length || 0;

    return {
      matches: denom,
      goalsForAvg: avg(goalsFor),
      goalsAgainstAvg: avg(goalsAgainst),
      pointsAvg: avg(points),
      winRate: safeDivide(wins, denom),
      drawRate: safeDivide(draws, denom),
      lossRate: safeDivide(losses, denom),
      csRate: safeDivide(cleanSheets, denom),
      ftsRate: safeDivide(failedToScore, denom),
    };
  }

  function computeXgN(n: number) {
    const xgMatches = finished
      .filter((f: any) => Array.isArray(f?.xgfixture) && f.xgfixture.length >= 2)
      .slice(0, n);

    const xgFor: number[] = [];
    const xgAgainst: number[] = [];

    for (const fx of xgMatches) {
      const teamXg = fx.xgfixture.find((x: any) => x?.participant_id === teamId)
        ?.data?.value;

      const oppXg = fx.xgfixture.find((x: any) => x?.participant_id !== teamId)
        ?.data?.value;

      if (typeof teamXg === "number" && typeof oppXg === "number") {
        xgFor.push(teamXg);
        xgAgainst.push(oppXg);
      }
    }

    const aFor = avg(xgFor);
    const aAgainst = avg(xgAgainst);

    return {
      sampleSize: xgFor.length,
      xgForAvg: aFor,
      xgAgainstAvg: aAgainst,
      xgDiffAvg:
        xgFor.length && xgAgainst.length ? (aFor ?? 0) - (aAgainst ?? 0) : null,
    };
  }

  // Existing v1 behaviour (N=ENV counts)
  const formN = ENV.FEATURES.FORM_MATCH_COUNT; // currently 5
  const xgN = ENV.FEATURES.XG_MATCH_COUNT; // currently 5

  const form5 = computeFormN(formN);
  const xg5 = computeXgN(xgN);

  // New: 10-match horizon (stable)
  const form10 = computeFormN(10);
  const xg10 = computeXgN(10);

  // Preserve existing naming in downstream:
  // form5 fields currently expect *Avg5 / *Rate5 etc.
  // We'll provide both: legacy-shaped + richer shaped.
  const legacyForm5 = {
    matches: form5.matches,
    goalsForAvg5: form5.goalsForAvg,
    goalsAgainstAvg5: form5.goalsAgainstAvg,
    pointsAvg5: form5.pointsAvg,
    winRate5: form5.winRate,
    drawRate5: form5.drawRate,
    lossRate5: form5.lossRate,
    csRate5: form5.csRate,
    ftsRate5: form5.ftsRate,
  };

  const legacyXg5 = {
    sampleSize: xg5.sampleSize,
    xgForAvg5: xg5.xgForAvg,
    xgAgainstAvg5: xg5.xgAgainstAvg,
    xgDiffAvg5: xg5.xgDiffAvg,
  };

  const legacyForm10 = {
    matches: form10.matches,
    goalsForAvg10: form10.goalsForAvg,
    goalsAgainstAvg10: form10.goalsAgainstAvg,
    pointsAvg10: form10.pointsAvg,
    winRate10: form10.winRate,
    drawRate10: form10.drawRate,
    lossRate10: form10.lossRate,
    csRate10: form10.csRate,
    ftsRate10: form10.ftsRate,
  };

  const legacyXg10 = {
    sampleSize: xg10.sampleSize,
    xgForAvg10: xg10.xgForAvg,
    xgAgainstAvg10: xg10.xgAgainstAvg,
    xgDiffAvg10: xg10.xgDiffAvg,
  };

  return {
    restDays,
    form5: legacyForm5,
    xg5: legacyXg5,
    form10: legacyForm10,
    xg10: legacyXg10,
  };
}
