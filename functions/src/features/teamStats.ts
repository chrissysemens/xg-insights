// functions/src/features/teamStats.ts
import { ENV } from "../config";
import { fetchJSON, fixturesBetweenByTeam } from "../sportmonks/client";
import { getFinalScore } from "../sportmonks/parsers";
import { avg, safeDivide } from "../utils/math";

/**
 * Rolling form + xG features for a team
 * IO: SportsMonks fetch
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
    .filter((f: any) => f?.state?.short_name === "FT" || f?.state?.shortName === "FT")
    .sort(
      (a: any, b: any) =>
        new Date(b.starting_at ?? b.startingAt ?? 0).getTime() -
        new Date(a.starting_at ?? a.startingAt ?? 0).getTime()
    );

  // ---------- FORM (last N) ----------
  const formCount = ENV.FEATURES.FORM_MATCH_COUNT;
  const formMatches = finished.slice(0, formCount);

  let wins = 0;
  let draws = 0;
  let losses = 0;

  const goalsFor: number[] = [];
  const goalsAgainst: number[] = [];
  const points: number[] = [];

  for (const fx of formMatches) {
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

  const denomForm = formMatches.length || 0;

  const form5 = {
    matches: denomForm,
    goalsForAvg5: avg(goalsFor),
    goalsAgainstAvg5: avg(goalsAgainst),
    pointsAvg5: avg(points),
    winRate5: safeDivide(wins, denomForm),
    drawRate5: safeDivide(draws, denomForm),
    lossRate5: safeDivide(losses, denomForm),
  };

  // ---------- xG (last N with xG) ----------
  const xgCount = ENV.FEATURES.XG_MATCH_COUNT;

  const xgMatches = finished
    .filter((f: any) => Array.isArray(f?.xgfixture) && f.xgfixture.length >= 2)
    .slice(0, xgCount);

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

  const xg5 = {
    sampleSize: xgFor.length,
    xgForAvg5: avg(xgFor),
    xgAgainstAvg5: avg(xgAgainst),
    xgDiffAvg5:
      xgFor.length && xgAgainst.length ? avg(xgFor)! - avg(xgAgainst)! : null,
  };

  return { form5, xg5 };
}
