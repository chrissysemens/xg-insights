import { ENV } from "../config";
import { fixturesBetweenByTeam, fetchJSON } from "../sportmonks/client";
import { getFinalScore } from "../sportmonks/parsers";
import { FormLetter } from "../types";
import {
  extractTeamAndOppXg,
  getXgFixtureArray,
  weightedAvg,
} from "../utils/helpers";
import { avg, safeDivide } from "../utils/math";

// Weighted averages (Most recent matches have higher weight)
const W5 = [1.0, 0.85, 0.7, 0.55, 0.4];
const W10 = [1.0, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26];

export const computeTeamStats = async (teamId: number, token: string) => {
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
    ENV.SPORTSMONKS.BASE_URL,
  );

  const json = await fetchJSON(url);
  if (!Array.isArray(json?.data)) {
    throw new Error(
      `Unexpected SportsMonks response for team ${teamId}: data is not array`,
    );
  }

  const finished = json.data
    .filter(
      (f: any) =>
        f?.state?.short_name === "FT" ||
        f?.state?.shortName === "FT" ||
        f?.state?.short_name === "AET" ||
        f?.state?.shortName === "AET",
    )
    .sort(
      (a: any, b: any) =>
        new Date(b.starting_at ?? b.startingAt ?? 0).getTime() -
        new Date(a.starting_at ?? a.startingAt ?? 0).getTime(),
    );

  // Calculate teams rest days since last match
  const lastFinished = finished[0];
  const lastKickoff = lastFinished
    ? new Date(
        lastFinished.starting_at ?? lastFinished.startingAt ?? 0,
      ).getTime()
    : null;

  const restDays =
    lastKickoff != null
      ? Math.max(
          0,
          Math.floor((Date.now() - lastKickoff) / (1000 * 60 * 60 * 24)),
        )
      : null;

  const computeLastNResults = (n: number): FormLetter[] => {
    const matches = finished.slice(0, n);
    const out: FormLetter[] = [];

    for (const fx of matches) {
      const score = getFinalScore(fx.scores);
      if (!score) continue;

      const isHome = Array.isArray(fx.participants)
        ? fx.participants.some(
            (p: any) => p?.id === teamId && p?.meta?.location === "home",
          )
        : false;

      const gf = isHome ? score.home : score.away;
      const ga = isHome ? score.away : score.home;

      if (typeof gf !== "number" || typeof ga !== "number") continue;
      out.push(gf > ga ? "W" : gf === ga ? "D" : "L");
    }

    return out;
  };

  const computeLastNXg = (
    n: number,
  ): { xgFor: number[]; xgAgainst: number[] } => {
    const outFor: number[] = [];
    const outAgainst: number[] = [];

    for (const fx of finished) {
      const xgArr = getXgFixtureArray(fx);
      if (xgArr.length < 2) continue;

      const { teamXg, oppXg } = extractTeamAndOppXg(xgArr, teamId);
      if (teamXg != null && oppXg != null) {
        outFor.push(teamXg);
        outAgainst.push(oppXg);
      }

      if (outFor.length >= n) break;
    }

    return { xgFor: outFor, xgAgainst: outAgainst };
  };

  const computeFormN = (n: number) => {
    const slice = finished.slice(0, n);

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let cleanSheets = 0;
    let failedToScore = 0;

    const goalsFor: number[] = [];
    const goalsAgainst: number[] = [];
    const points: number[] = [];

    let used = 0;

    for (const fx of slice) {
      const score = getFinalScore(fx.scores);
      if (!score) continue;

      const isHome = Array.isArray(fx.participants)
        ? fx.participants.some(
            (p: any) => p?.id === teamId && p?.meta?.location === "home",
          )
        : false;

      const gf = isHome ? score.home : score.away;
      const ga = isHome ? score.away : score.home;

      if (typeof gf !== "number" || typeof ga !== "number") continue;

      used++;

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

    const denom = used;

    const gfW = weightedAvg(goalsFor, n === 5 ? W5 : W10);
    const gaW = weightedAvg(goalsAgainst, n === 5 ? W5 : W10);
    const ptsW = weightedAvg(points, n === 5 ? W5 : W10);

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

      // weighted
      goalsForWAvg: gfW,
      goalsAgainstWAvg: gaW,
      pointsWAvg: ptsW,
    };
  };

  function computeXgN(n: number) {
    const slice = finished
      .filter((f: any) => getXgFixtureArray(f).length >= 2)
      .slice(0, n); // newest -> oldest

    const xgFor: number[] = [];
    const xgAgainst: number[] = [];

    for (const fx of slice) {
      const xgArr = getXgFixtureArray(fx);
      const { teamXg, oppXg } = extractTeamAndOppXg(xgArr, teamId);
      if (teamXg != null && oppXg != null) {
        xgFor.push(teamXg);
        xgAgainst.push(oppXg);
      }
    }

    const aFor = avg(xgFor);
    const aAgainst = avg(xgAgainst);

    const w = n === 5 ? W5 : W10;
    const wFor = weightedAvg(xgFor, w);
    const wAgainst = weightedAvg(xgAgainst, w);

    return {
      sampleSize: xgFor.length,

      // unweighted
      xgForAvg: aFor,
      xgAgainstAvg: aAgainst,
      xgDiffAvg:
        xgFor.length && xgAgainst.length ? (aFor ?? 0) - (aAgainst ?? 0) : null,

      // weighted
      xgForWAvg: wFor,
      xgAgainstWAvg: wAgainst,
      xgDiffWAvg:
        wFor != null && wAgainst != null
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
    xgLast5ForAvg: avg(xgLast5.xgFor),
    xgLast5AgainstAvg: avg(xgLast5.xgAgainst),
  };
};
