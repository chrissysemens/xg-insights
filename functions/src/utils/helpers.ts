import { ENV } from "../config";
import {
  BTTS_HIGHLIGHT_MIN,
  FINISHED_STATES,
  OVER25_HIGHLIGHT_MIN,
  RESULT_GAP_MIN,
  RESULT_HIGHLIGHT_MIN,
} from "../consts";
import { fetchJSON, fixturesBetweenByTeam } from "../sportmonks/client";
import {
  Fixture,
  Goals,
  HighlightReason,
  Pagination,
  Participant,
  Pick,
  PredictBatchResponse,
  ResultPick,
} from "../types";
import { numOrNull } from "./math";
import { OddsSnapshot } from "../types";
import { impliedFromDecimal } from "../utils/math";

/**
 * Returns whether both teams scored in a match.
 * @param hg - home goals
 * @param ag - away goals
 * @returns - Pick ("Y" for yes, "N" for no)
 */
export const actualBTTS = (hg: number, ag: number): Pick => {
  return hg > 0 && ag > 0 ? "Y" : "N";
};

/**
 * Returns whether the total goals scored is over 2.5.
 * @param hg - home goals
 * @param ag - away goals
 * @returns Pick ("Y" for yes, "N" for no)
 */
export const actualOver25 = (hg: number, ag: number): Pick => {
  return hg + ag >= 3 ? "Y" : "N";
};

/**
 * Returns the actual match result based on home and away goals.
 * @param hg - home goals
 * @param ag  - away goals
 * @returns - ResultPick ("H", "D", or "A")
 */
export const actualResult = (hg: number, ag: number): ResultPick => {
  if (hg > ag) return "H";
  if (hg < ag) return "A";
  return "D";
};

/**
 *Builds ML feature set for a fixture based on team statistics.
 * @param fx - Fixture object
 * @param homeStats - Home team statistics
 * @param awayStats - Away team statistics
 * @returns - Object containing features and derived statistics
 */
export const buildFeatures = (fx: any, homeStats: any, awayStats: any) => {
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
    pointsGap5:
      homeForm5.pointsAvg5 != null && awayForm5.pointsAvg5 != null
        ? Number(homeForm5.pointsAvg5) - Number(awayForm5.pointsAvg5)
        : null,
    goalForGap5:
      homeForm5.goalsForAvg5 != null && awayForm5.goalsForAvg5 != null
        ? Number(homeForm5.goalsForAvg5) - Number(awayForm5.goalsForAvg5)
        : null,
    goalsAgainstGap5:
      homeForm5.goalsAgainstAvg5 != null && awayForm5.goalsAgainstAvg5 != null
        ? Number(homeForm5.goalsAgainstAvg5) -
          Number(awayForm5.goalsAgainstAvg5)
        : null,

    homeSample5: numOrNull(homeForm5.matches),
    awaySample5: numOrNull(awayForm5.matches),

    // tempo/script (xG) - unweighted
    expectedGoalsTotal5:
      homeXg5.xgForAvg5 != null && awayXg5.xgForAvg5 != null
        ? Number(homeXg5.xgForAvg5) + Number(awayXg5.xgForAvg5)
        : null,
    expectedGoalsAsym5:
      homeXg5.xgDiffAvg5 != null && awayXg5.xgDiffAvg5 != null
        ? Math.abs(Number(homeXg5.xgDiffAvg5) - Number(awayXg5.xgDiffAvg5))
        : null,

    expectedGoalsTotal10:
      homeXg10.xgForAvg10 != null && awayXg10.xgForAvg10 != null
        ? Number(homeXg10.xgForAvg10) + Number(awayXg10.xgForAvg10)
        : null,
    expectedGoalsAsym10:
      homeXg10.xgDiffAvg10 != null && awayXg10.xgDiffAvg10 != null
        ? Math.abs(Number(homeXg10.xgDiffAvg10) - Number(awayXg10.xgDiffAvg10))
        : null,

    // tempo/script (xG) - weighted
    expectedGoalsTotalW5:
      homeXg5.xgForWAvg5 != null && awayXg5.xgForWAvg5 != null
        ? Number(homeXg5.xgForWAvg5) + Number(awayXg5.xgForWAvg5)
        : null,
    expectedGoalsAsymW5:
      homeXg5.xgDiffWAvg5 != null && awayXg5.xgDiffWAvg5 != null
        ? Math.abs(Number(homeXg5.xgDiffWAvg5) - Number(awayXg5.xgDiffWAvg5))
        : null,

    expectedGoalsTotalW10:
      homeXg10.xgForWAvg10 != null && awayXg10.xgForWAvg10 != null
        ? Number(homeXg10.xgForWAvg10) + Number(awayXg10.xgForWAvg10)
        : null,
    expectedGoalsAsymW10:
      homeXg10.xgDiffWAvg10 != null && awayXg10.xgDiffWAvg10 != null
        ? Math.abs(
            Number(homeXg10.xgDiffWAvg10) - Number(awayXg10.xgDiffWAvg10),
          )
        : null,

    // BTTS suppression (clean sheets + failed to score)
    bttsSuppress5:
      homeForm5.csRate5 != null &&
      awayForm5.csRate5 != null &&
      homeForm5.ftsRate5 != null &&
      awayForm5.ftsRate5 != null
        ? Math.max(Number(homeForm5.csRate5), Number(awayForm5.csRate5)) +
          Math.max(Number(homeForm5.ftsRate5), Number(awayForm5.ftsRate5))
        : null,

    bttsSuppress10:
      homeForm10.csRate10 != null &&
      awayForm10.csRate10 != null &&
      homeForm10.ftsRate10 != null &&
      awayForm10.ftsRate10 != null
        ? Math.max(Number(homeForm10.csRate10), Number(awayForm10.csRate10)) +
          Math.max(Number(homeForm10.ftsRate10), Number(awayForm10.ftsRate10))
        : null,
  };

  const features: Record<string, number | null> = {
    // table context
    home_position: numOrNull(fx.homePosition),
    away_position: numOrNull(fx.awayPosition),
    derived_positionGap:
      fx.homePosition != null && fx.awayPosition != null
        ? numOrNull(Number(fx.homePosition) - Number(fx.awayPosition))
        : null,

    // rest days
    home_restDays: numOrNull(homeStats?.restDays),
    away_restDays: numOrNull(awayStats?.restDays),
    derived_restGap:
      homeStats?.restDays != null && awayStats?.restDays != null
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
};

/**
 * Chunks an array into smaller arrays of a specified size.
 * @param arr - Original array
 * @param size - Size of each chunk
 * @returns - Array of chunked arrays
 */
export const chunk = <T>(arr: T[], size: number): T[][] => {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Computes highlight metadata for a prediction.
 * @param p - Prediction object
 * @returns - Object containing highlight score and reason
 */
export const computeHighlightMeta = (
  p: PredictBatchResponse["predictions"][number],
) => {
  const candidates: Array<{ reason: HighlightReason; score: number }> = [];

  // Exclusive goals highlight: either BTTS or Over2.5
  const bttsY = p.btts?.Y ?? 0;
  const overY = p.over25?.Y ?? 0;

  const bttsOk = p.btts?.pick === "Y" && bttsY >= BTTS_HIGHLIGHT_MIN;
  const overOk = p.over25?.pick === "Y" && overY >= OVER25_HIGHLIGHT_MIN;

  if (bttsOk || overOk) {
    // Choose highest scoring
    if (overOk && (!bttsOk || overY >= bttsY)) {
      candidates.push({ reason: HighlightReason.HIGH_GOALS, score: overY });
    } else if (bttsOk) {
      candidates.push({ reason: HighlightReason.BTTS_LIKELY, score: bttsY });
    }
  }

  // Favourite highlight: must pass MIN and be clearly separated by GAP
  const fav = pickedResultProb(p);
  const gap = resultGap(p);

  if (fav >= RESULT_HIGHLIGHT_MIN && gap >= RESULT_GAP_MIN) {
    candidates.push({ reason: HighlightReason.CLEAR_FAVOURITE, score: fav });
  }

  // Fallback: always return something for sorting/scoring, even if unqualified
  if (candidates.length === 0) {
    return {
      highlightScore: fav,
      highlightReason: HighlightReason.CLEAR_FAVOURITE,
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    highlightScore: candidates[0].score,
    highlightReason: candidates[0].reason,
  };
};

/**
 * Returns the final score from a fixture object.
 * @param fx - Fixture object containing home and away goals
 * @returns - Object with homeGoals (hg) and awayGoals (ag), or null if not available
 */
export function extractFinalScoreFromFixture(fx: {
  homeGoals?: number | null;
  awayGoals?: number | null;
}) {
  if (fx.homeGoals == null || fx.awayGoals == null) return null;
  return { hg: fx.homeGoals, ag: fx.awayGoals };
}

/**
 * Retrieves the final score from an array of score objects.
 * @param scores - Array of score objects
 * @returns - Object with homeGoals (hg) and awayGoals (ag), or null if not found
 */
export function extractFinalScoreFromScoresArray(
  scores: any[] | null | undefined,
) {
  if (!Array.isArray(scores)) return null;

  const s = scores.find(
    (x) =>
      x?.description === "CURRENT" ||
      x?.description === "FT" ||
      x?.description === "AET",
  );

  const home = s?.score?.home;
  const away = s?.score?.away;

  return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
}

/**
 * Extracts current goals from fixture data.
 * @param fx - fixture object
 * @returns - Goals | null
 */
export const extractCurrentGoals = (fx: any): Goals | null => {
  const parts: any[] = fx?.participants ?? [];
  const home = parts.find((p) => p?.meta?.location === "home");
  const away = parts.find((p) => p?.meta?.location === "away");
  if (!home?.id || !away?.id) return null;

  const homeId = Number(home.id);
  const awayId = Number(away.id);

  const scores: any[] = fx?.scores ?? [];
  if (!Array.isArray(scores) || scores.length === 0) return null;

  const rows = pickScoreRows(scores);
  if (rows.length === 0) return null;

  let homeGoals: number | null = null;
  let awayGoals: number | null = null;

  for (const s of rows) {
    const pidRaw = s?.participant_id;
    const goalsRaw = s?.score?.goals;

    if (pidRaw == null || goalsRaw == null) continue;

    const pid = Number(pidRaw);
    const goals = Number(goalsRaw);

    if (pid === homeId) homeGoals = goals;
    if (pid === awayId) awayGoals = goals;
  }

  if (homeGoals == null || awayGoals == null) return null;
  return { homeGoals, awayGoals };
};

/**
 * Extracts home and away participants and positions.
 * @param participants - Participant array
 * @returns - Object with home and away participants and their IDs and positions, or null if not found
 */
export const extractHomeAway = (participants: Participant[]) => {
  const home = participants.find((p) => p.meta?.location === "home");
  const away = participants.find((p) => p.meta?.location === "away");
  if (!home || !away) return null;

  return {
    home,
    away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homePosition: home.meta?.position ?? null,
    awayPosition: away.meta?.position ?? null,
  };
};

/**
 * Extracts home and away team IDs from a fixture object.
 * @param fixture - Fixture object
 * @returns - Object containing homeTeamId and awayTeamId
 */
export const extractTeamIds = (fixture: any) => {
  const homeTeamId = fixture.participants?.find(
    (p: any) => p.meta?.location === "home",
  )?.id;
  const awayTeamId = fixture.participants?.find(
    (p: any) => p.meta?.location === "away",
  )?.id;
  return { homeTeamId, awayTeamId };
};

/**
 * Extracts team and opponent xG values from an xG array.
 * @param xgArr - xG array
 * @param teamId -  Team ID
 * @returns - Object with teamXg and oppXg values, or null if not found
 */
export const extractTeamAndOppXg = (
  xgArr: any[],
  teamId: number,
): { teamXg: number | null; oppXg: number | null } => {
  if (!Array.isArray(xgArr) || xgArr.length < 2)
    return { teamXg: null, oppXg: null };

  const teamObj = xgArr.find((x: any) => x?.participant_id === teamId);
  const oppObj = xgArr.find((x: any) => x?.participant_id !== teamId);

  const teamXg = teamObj?.data?.value;
  const oppXg = oppObj?.data?.value;

  return {
    teamXg: typeof teamXg === "number" ? teamXg : null,
    oppXg: typeof oppXg === "number" ? oppXg : null,
  };
};

/**
 * Returns head-to-head fixtures between two teams.
 * @param homeTeamId - number
 * @param awayTeamId - number
 * @param token - string
 * @param count - number of fixtures to retrieve (default is 5)
 * @returns Array of head-to-head fixture objects
 */
export const fetchH2H = async (
  homeTeamId: number,
  awayTeamId: number,
  token: string,
  count = 5,
) => {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 365 * 3); // last 3 seasons

  const url = fixturesBetweenByTeam(
    homeTeamId,
    from.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10),
    token,
    ENV.SPORTSMONKS.BASE_URL,
  );

  const json = await fetchJSON(url);
  if (!Array.isArray(json?.data)) return [];

  return json.data
    .filter(
      (f: any) =>
        (f?.state?.short_name === "FT" ||
          f?.state?.shortName === "FT" ||
          f?.state?.short_name === "AET" ||
          f?.state?.shortName === "AET") &&
        Array.isArray(f.participants) &&
        f.participants.some((p: any) => p?.id === awayTeamId),
    )
    .sort(
      (a: any, b: any) =>
        Number(b.starting_at_timestamp ?? 0) -
        Number(a.starting_at_timestamp ?? 0),
    )
    .slice(0, count)
    .map((f: any) => {
      const score = extractFinalScoreFromScoresArray(f.scores);
      if (!score) return null;

      const home = f.participants.find(
        (p: any) => p?.meta?.location === "home",
      );
      const away = f.participants.find(
        (p: any) => p?.meta?.location === "away",
      );

      return {
        homeName: home?.name ?? "Home",
        awayName: away?.name ?? "Away",
        homeGoals: score.home,
        awayGoals: score.away,
        startingAtTimestamp:
          f.starting_at_timestamp ??
          Math.floor(new Date(f.starting_at).getTime() / 1000),
      };
    })
    .filter(Boolean);
};

/**
 * Gets the final score from an array of score objects.
 * @param scores
 * @returns - An object with home and away scores, or null if not found
 */
export const getFinalScore = (scores: any[]) => {
  const home = scores.find(
    (s) => s.description === "CURRENT" && s.score.participant === "home",
  )?.score.goals;
  const away = scores.find(
    (s) => s.description === "CURRENT" && s.score.participant === "away",
  )?.score.goals;
  if (typeof home !== "number" || typeof away !== "number") return null;
  return { home, away };
};

/**
 * Get pagination info from API response.
 * SportMonks responses can vary by endpoint/version,
 * some use json.pagination, some use json.meta.pagination
 * @param json - API response object
 * @returns - Pagination object or null if not found
 */
export const getPagination = (json: any): Pagination | null => {
  return (json?.pagination ??
    json?.meta?.pagination ??
    null) as Pagination | null;
};

/**
 * Retrieves the xG fixture array from a fixture object, handling different casing.
 * @param {*} fx - Fixture object
 * @return {*}  {any[]}
 */
export const getXgFixtureArray = (fx: any): any[] => {
  const a = fx?.xgfixture;
  if (Array.isArray(a)) return a;
  const b = fx?.xgFixture;
  if (Array.isArray(b)) return b;
  return [];
};

/**
 * Checks if a fixture is in a finished state based on its short name.
 * @param shortName - Short name of the fixture state
 * @returns - True if the fixture is finished, false otherwise
 */
export const isFinished = (shortName?: string) => {
  if (!shortName) return false;
  return FINISHED_STATES.has(shortName);
};

/**
 * Normalises 1X2 odds from various formats into a standard structure.
 * @param odds - unknown[] | undefined | null
 * @returns - OddsSnapshot | null
 */
export const normalise1x2Odds = (
  odds: unknown[] | undefined | null,
): OddsSnapshot | null => {
  if (!Array.isArray(odds) || odds.length === 0) return null;

  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;

  for (const o of odds) {
    const obj: any = o;

    const label = String(
      obj?.label ??
        obj?.name ??
        obj?.market_description ??
        obj?.type ??
        obj?.outcome ??
        "",
    )
      .toLowerCase()
      .trim();

    const value =
      oddsToDecimal(obj?.value) ??
      oddsToDecimal(obj?.odd) ??
      oddsToDecimal(obj?.odds) ??
      null;

    if (!value) continue;

    if (label === "1" || label.includes("home"))
      home = Math.max(home ?? 0, value);
    else if (label === "x" || label.includes("draw"))
      draw = Math.max(draw ?? 0, value);
    else if (label === "2" || label.includes("away"))
      away = Math.max(away ?? 0, value);
  }

  if (home == null && draw == null && away == null) return null;

  return {
    market: "1x2",
    decimal: { home, draw, away },
    implied: {
      home: impliedFromDecimal(home),
      draw: impliedFromDecimal(draw),
      away: impliedFromDecimal(away),
    },
  };
};

/**
 * Converts SportsMonks odds to decimal odds.
 * Handles scaled values (e.g. 301 -> 3.01).
 */
export const oddsToDecimal = (n: unknown): number | null => {
  if (n == null) return null;

  const raw =
    typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;

  if (!Number.isFinite(raw)) return null;

  // SportsMonks often returns odds * 100
  const value = raw >= 100 ? raw / 100 : raw;

  return value > 1 ? Number(value.toFixed(3)) : null;
};

/**
 * Picks score rows from scores array, prioritizing "CURRENT" then "FT".
 * @param scores - any[]
 * @returns - any[]
 */
export const pickScoreRows = (scores: any[]): any[] => {
  const byDesc = (d: string) =>
    scores.filter((s) => String(s?.description ?? "").toUpperCase() === d);

  const current = byDesc("CURRENT");
  if (current.length) return current;

  const ft = byDesc("FT");
  if (ft.length) return ft;

  return [];
};

/**
 * Get the probability of the picked result.
 * @param {PredictBatchResponse["predictions"][number]} p
 * @return {*} - probability number
 */
export const pickedResultProb = (
  p: PredictBatchResponse["predictions"][number],
) => {
  const pick = p.matchResult.pick;
  if (pick === "H") return p.matchResult.H ?? 0;
  if (pick === "D") return p.matchResult.D ?? 0;
  return p.matchResult.A ?? 0;
};

/**
 * Provides a safe way to get the league name from a fixture.
 * @param f - Fixture object
 * @returns - League name or league ID as string if name is unavailable
 */
export const safeLeagueName = (f: Fixture) => {
  const n = (f as any)?.league?.name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return String(f.league_id);
};

/**
 * How “clear” the favourite is:
 * gap = bestProb - secondBestProb
 */
export const resultGap = (p: PredictBatchResponse["predictions"][number]) => {
  const H = Number(p.matchResult.H ?? 0);
  const D = Number(p.matchResult.D ?? 0);
  const A = Number(p.matchResult.A ?? 0);

  const probs = [H, D, A].sort((a, b) => b - a);
  const best = probs[0] ?? 0;
  const second = probs[1] ?? 0;
  return Math.max(0, best - second);
};

/**
 * Calculates the weighted average of given values and weights.
 * @param values - Array of numbers
 * @param weights - Array of weights
 * @returns - Weighted average or null if values array is empty or weights sum to zero
 */
export const weightedAvg = (values: number[], weights: number[]) => {
  if (!values.length) return null;
  const w = weights.slice(0, values.length);
  const denom = w.reduce((a, b) => a + b, 0);
  if (!denom) return null;
  const num = values.reduce((sum, v, i) => sum + v * (w[i] ?? 0), 0);
  return num / denom;
};
