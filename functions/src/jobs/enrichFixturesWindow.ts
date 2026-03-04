import * as admin from "firebase-admin";
import { ENV } from "../config";
import { computeTeamStats } from "../features/teamStats";
import { buildFeatures, fetchH2H } from "../utils/helpers";

const FEATURES_VERSION = 1;

// If > 0: skip re-enrichment when lastEnrichedAt is newer than this
const REENRICH_AFTER_MINUTES = 0;

// If a fixture errored recently, skip retry for this many minutes
const RETRY_FAIL_AFTER_MINUTES = 30;

// Firestore batch hard limit is 500 operations; keep buffer
const MAX_BATCH_OPS = 450;

const minutesAgo = (mins: number) => Date.now() - mins * 60 * 1000;

const safeErrMsg = (e: unknown) => {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
};

export const enrichFixturesWindow = async (token: string) => {
  const startedAtMs = Date.now();
  const db = admin.firestore();
  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  const PAGE_SIZE = Math.max(1, ENV.FEATURES.ENRICH_LIMIT);

  /**
   * Cache Promises so multiple fixtures needing the same team/H2H
   * don’t trigger duplicate in-flight requests.
   */
  const teamCache = new Map<
    number,
    Promise<Awaited<ReturnType<typeof computeTeamStats>>>
  >();

  const h2hCache = new Map<string, Promise<any[]>>();

  const getTeamStatsCached = (id: number) => {
    if (!teamCache.has(id)) {
      teamCache.set(id, computeTeamStats(id, token));
    }
    return teamCache.get(id)!;
  };

  const getH2HCached = (h: number, a: number) => {
    const key = `${Math.min(h, a)}-${Math.max(h, a)}`;
    if (!h2hCache.has(key)) {
      h2hCache.set(key, fetchH2H(h, a, token));
    }
    return h2hCache.get(key)!;
  };

  let batch = db.batch();
  let operations = 0;

  let scanned = 0;
  let enriched = 0;
  let skippedMissingTeams = 0;
  let skippedFresh = 0;
  let skippedRecentFail = 0;
  let failed = 0;

  const commitIfNeeded = async () => {
    if (operations >= MAX_BATCH_OPS) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  };

  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let pageQuery: FirebaseFirestore.Query = db
      .collection("fixtures_live")
      .where("inWindow", "==", true)
      .orderBy(admin.firestore.FieldPath.documentId(), "asc")
      .limit(PAGE_SIZE);

    if (lastDoc) {
      pageQuery = pageQuery.startAfter(lastDoc);
    }

    const pageSnap = await pageQuery.get();
    if (pageSnap.empty) {
      break;
    }

    scanned += pageSnap.size;

    for (const docSnap of pageSnap.docs) {
      const fx = docSnap.data() as any;
      const fixtureId = docSnap.id;

      const { homeTeamId, awayTeamId } = fx;

      if (!homeTeamId || !awayTeamId) {
        skippedMissingTeams++;
        continue;
      }

      // Skip if freshly enriched
      if (REENRICH_AFTER_MINUTES > 0 && fx.lastEnrichedAt?.toMillis) {
        const tsMs = fx.lastEnrichedAt.toMillis();
        if (tsMs > minutesAgo(REENRICH_AFTER_MINUTES)) {
          skippedFresh++;
          continue;
        }
      }

      // Skip if recently failed (backoff)
      if (
        RETRY_FAIL_AFTER_MINUTES > 0 &&
        fx.lastEnrichErrorAt?.toMillis &&
        fx.lastEnrichErrorAt.toMillis() > minutesAgo(RETRY_FAIL_AFTER_MINUTES)
      ) {
        skippedRecentFail++;
        continue;
      }

      let homeStats: any;
      let awayStats: any;
      let h2h: any[];

      try {
        [homeStats, awayStats, h2h] = await Promise.all([
          getTeamStatsCached(homeTeamId),
          getTeamStatsCached(awayTeamId),
          getH2HCached(homeTeamId, awayTeamId),
        ]);
      } catch (e) {
        failed++;
        const msg = safeErrMsg(e);

        console.error("[enrichFixturesWindow] enrichment failed", {
          fixtureId,
          homeTeamId,
          awayTeamId,
          error: msg,
        });

        // Mark failure on the fixture doc so you can see and backoff
        batch.set(
          docSnap.ref,
          {
            lastEnrichError: msg.slice(0, 500),
            lastEnrichErrorAt: nowTs,
          },
          { merge: true },
        );
        operations++;
        await commitIfNeeded();
        continue;
      }

      // Build features
      const { features, derived } = buildFeatures(fx, homeStats, awayStats);

      // Write back to fixtures_live
      batch.set(
        docSnap.ref,
        {
          features,
          featuresRaw: {
            home: homeStats,
            away: awayStats,
            derived,
          },
          featuresVersion: FEATURES_VERSION,
          lastEnrichedAt: nowTs,

          // Clear prior errors on success
          lastEnrichError: admin.firestore.FieldValue.delete(),
          lastEnrichErrorAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );
      operations++;
      enriched++;
      await commitIfNeeded();

      // Denormalized details document
      batch.set(
        db.collection("fixture_details").doc(fixtureId),
        {
          fixtureId,
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
          h2h: h2h ?? [],
          updatedAt: nowTs,
        },
        { merge: true },
      );
      operations++;
      await commitIfNeeded();
    }

    lastDoc = pageSnap.docs[pageSnap.docs.length - 1];

    if (pageSnap.size < PAGE_SIZE) {
      break;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }

  if (scanned === 0) {
    console.log("enrichFixturesWindow: no inWindow fixtures");
    return;
  }

  const durationMs = Date.now() - startedAtMs;
  const successRate = scanned > 0 ? Number((enriched / scanned).toFixed(4)) : 0;
  const failRate = scanned > 0 ? Number((failed / scanned).toFixed(4)) : 0;

  console.log("[enrichFixturesWindow] done", {
    durationMs,
    pageSize: PAGE_SIZE,
    scanned,
    enriched,
    failed,
    successRate,
    failRate,
    skippedMissingTeams,
    skippedFresh,
    skippedRecentFail,
    featuresVersion: FEATURES_VERSION,
    reEnrichAfterMinutes: REENRICH_AFTER_MINUTES,
    retryFailAfterMinutes: RETRY_FAIL_AFTER_MINUTES,
  });
};
