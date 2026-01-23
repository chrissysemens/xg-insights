import * as admin from "firebase-admin";
import { ENV } from "../config";
import { computeTeamStats } from "../features/teamStats";
import { buildFeatures, fetchH2H } from "../utils/helpers";

/**
 * Enrich fixtures in fixtures_live with ML features
 * @param token - SportMonks API token
 * @returns - void
 */
export const enrichFixturesWindow = async(token: string) => {
  const db = admin.firestore();

  // Prefer inWindow fixtures
  const snap = await db
    .collection("fixtures_live")
    .where("inWindow", "==", true)
    .limit(ENV.FEATURES.ENRICH_LIMIT)
    .get();

  if (snap.empty) {
    console.log("enrichFixturesWindow: no inWindow fixtures");
    return;
  }

  const teamCache = new Map<
    number,
    Awaited<ReturnType<typeof computeTeamStats>>
  >();
  const h2hCache = new Map<string, any[]>();

  const getTeamStatsCached = async (id: number) => {
    if (!teamCache.has(id)) {
      teamCache.set(id, await computeTeamStats(id, token));
    }
    return teamCache.get(id)!;
  };

  const getH2HCached = async (h: number, a: number) => {
    const key = `${Math.min(h, a)}-${Math.max(h, a)}`;
    if (!h2hCache.has(key)) {
      h2hCache.set(key, await fetchH2H(h, a, token));
    }
    return h2hCache.get(key)!;
  };

  let batch = db.batch();
  let operations = 0;

  let enriched = 0;
  let skippedMissingTeams = 0;

  for (const docSnap of snap.docs) {
    const fx = docSnap.data() as any;
    const { homeTeamId, awayTeamId } = fx;

    if (!homeTeamId || !awayTeamId) {
      skippedMissingTeams++;
      continue;
    }

    const [homeStats, awayStats, h2h] = await Promise.all([
      getTeamStatsCached(homeTeamId),
      getTeamStatsCached(awayTeamId),
      getH2HCached(homeTeamId, awayTeamId),
    ]);

    const { features, derived } = buildFeatures(fx, homeStats, awayStats);

    // Write ML features into fixture doc
    batch.set(
      docSnap.ref,
      {
        features,
        featuresRaw: {
          home: homeStats,
          away: awayStats,
          derived,
        },
        lastEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    operations++;
    enriched++;

    // Write Enrichment details for UI into fixture_details
    batch.set(
      db.collection("fixture_details").doc(docSnap.id),
      {
        fixtureId: docSnap.id,
        homeTeamId,
        awayTeamId,
        form: {
          homeLast5: homeStats.formLast5 ?? null,
          awayLast5: awayStats.formLast5 ?? null,
        },
        xg: {
          homeLast5For: homeStats.xgLast5For ?? null,
          homeLast5Against: homeStats.xgLast5Against ?? null,
          homeLast5ForAvg: homeStats.xgLast5ForAvg ?? null,
          homeLast5AgainstAvg: homeStats.xgLast5AgainstAvg ?? null,
          awayLast5For: awayStats.xgLast5For ?? null,
          awayLast5Against: awayStats.xgLast5Against ?? null,
          awayLast5ForAvg: awayStats.xgLast5ForAvg ?? null,
          awayLast5AgainstAvg: awayStats.xgLast5AgainstAvg ?? null,
        },
        h2h,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    operations++;

    if (operations >= 450) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  }

  if (operations > 0) await batch.commit();
}
