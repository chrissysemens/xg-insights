import * as admin from "firebase-admin";
import { ENV } from "../config";
import { computeTeamStats } from "../features/teamStats";

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildFlatModelFeatures(fx: any, homeStats: any, awayStats: any) {
  // IMPORTANT: keys must match trainer/build_dataset.py output
  const homeForm5 = homeStats?.form5 ?? {};
  const awayForm5 = awayStats?.form5 ?? {};

  const derived = {
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
        ? Number(homeForm5.goalsAgainstAvg5) - Number(awayForm5.goalsAgainstAvg5)
        : null,

    homeSample5: numOrNull(homeForm5.matches),
    awaySample5: numOrNull(awayForm5.matches),
  };

  const flat: Record<string, number | null> = {
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

  // League one-hot: set the current league to 1
  const leagueId = fx?.leagueId ?? fx?.league_id;
  if (leagueId != null) {
    flat[`lg_${String(leagueId)}`] = 1;
  }

  return { flat, derived };
}

export async function enrichFixturesWindow(token: string) {
  const db = admin.firestore();

  // 1) Prefer "inWindow == true" (syncFixtures owns windowing)
  let snap = await db
    .collection("fixtures_live")
    .where("inWindow", "==", true)
    .limit(ENV.FEATURES.ENRICH_LIMIT)
    .get();

  // 2) Fallback: if inWindow isn't present/working yet, use timestamp window
  if (snap.empty) {
    const nowTs = Math.floor(Date.now() / 1000);
    const endTs = nowTs + ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS * 24 * 60 * 60;

    snap = await db
      .collection("fixtures_live")
      .where("startingAtTimestamp", ">=", nowTs)
      .where("startingAtTimestamp", "<=", endTs)
      .limit(ENV.FEATURES.ENRICH_LIMIT)
      .get();

    console.log(
      `enrichFixturesWindow: inWindow empty, fallback timestamp query returned ${snap.size}`
    );
  } else {
    console.log(`enrichFixturesWindow: found ${snap.size} inWindow fixtures`);
  }

  if (snap.empty) {
    console.log("enrichFixturesWindow: no fixtures in window");
    return;
  }

  const teamCache = new Map<number, Awaited<ReturnType<typeof computeTeamStats>>>();

  async function getTeamStatsCached(teamId: number) {
    const cached = teamCache.get(teamId);
    if (cached) return cached;

    const stats = await computeTeamStats(teamId, token);
    teamCache.set(teamId, stats);
    return stats;
  }

  let batch = db.batch();
  let ops = 0;

  let enriched = 0;
  let skippedMissingTeams = 0;

  for (const doc of snap.docs) {
    const fx = doc.data() as any;

    const homeTeamId: number | undefined = fx.homeTeamId;
    const awayTeamId: number | undefined = fx.awayTeamId;

    if (!homeTeamId || !awayTeamId) {
      skippedMissingTeams++;
      console.warn(`Fixture ${doc.id} missing homeTeamId/awayTeamId; skipping`);
      continue;
    }

    const [homeStats, awayStats] = await Promise.all([
      getTeamStatsCached(homeTeamId),
      getTeamStatsCached(awayTeamId),
    ]);

    const { flat, derived } = buildFlatModelFeatures(fx, homeStats, awayStats);

    batch.set(
      doc.ref,
      {
        // predictor uses this
        features: flat,

        // optional debug
        featuresRaw: {
          home: homeStats,
          away: awayStats,
          derived,
        },

        lastEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    enriched++;

    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  console.log(
    `enrichFixturesWindow: complete. enriched=${enriched}, skippedMissingTeams=${skippedMissingTeams}`
  );
}
