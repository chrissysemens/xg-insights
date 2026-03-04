import * as admin from "firebase-admin";
import { setTimeout as sleep } from "node:timers/promises";
import { ENV } from "../config";
import { PredictBatchRequest, PredictBatchResponse } from "../types";
import {
  chunk,
  computeHighlightMeta,
  pickedResultProb,
  resultGap,
} from "../utils/helpers";
import {
  BATCH_SIZE,
  BTTS_HIGHLIGHT_MIN,
  HIGHLIGHT_TOP_N,
  OVER25_HIGHLIGHT_MIN,
  RESULT_GAP_MIN,
  RESULT_HIGHLIGHT_MIN,
} from "../consts";

type MarketProbs1x2 = {
  home: number;
  draw: number;
  away: number;
  overround: number;
};

const isFiniteNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const clampProbability = (v: unknown) => {
  const n = isFiniteNum(v) ? v : 0;
  return Math.max(0, Math.min(1, n));
};

const isRetryableStatus = (status: number) => {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
};

const postPredictBatch = async (
  url: string,
  payload: PredictBatchRequest,
): Promise<PredictBatchResponse> => {
  const maxAttempts = 4;
  const baseDelayMs = 800;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `Cloud Run error ${res.status}: ${text.slice(0, 500)}`;

        if (attempt < maxAttempts && isRetryableStatus(res.status)) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter)
            ? retryAfter * 1000
            : baseDelayMs * Math.pow(2, attempt - 1);
          await sleep(waitMs);
          continue;
        }

        throw new Error(msg);
      }

      return (await res.json()) as PredictBatchResponse;
    } catch (e) {
      lastError = e;
      const isAbort = (e as any)?.name === "AbortError";
      const isNetworkTypeError = e instanceof TypeError;

      if (attempt < maxAttempts && (isAbort || isNetworkTypeError)) {
        const waitMs = baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(waitMs);
        continue;
      }

      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const runPredictionsWindow = async () => {
  const startedAtMs = Date.now();
  if (!ENV.PREDICTOR.BASE_URL) {
    throw new Error("Missing ENV.PREDICTOR.BASE_URL");
  }

  const modelVersion = ENV.PREDICTOR.MODEL_VERSION;
  const db = admin.firestore();

  const fixtures: any[] = [];
  const PAGE_SIZE = 200;
  let pagesRead = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let query: FirebaseFirestore.Query = db
      .collection("fixtures_live")
      .where("inWindow", "==", true)
      .where("state.shortName", "==", "NS")
      .orderBy("startingAtTimestamp", "asc")
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const qs = await query.get();
    if (qs.empty) {
      break;
    }

    pagesRead++;

    fixtures.push(
      ...qs.docs.map((d) => ({ docId: d.id, ...(d.data() as any) })),
    );

    lastDoc = qs.docs[qs.docs.length - 1];
    if (qs.size < PAGE_SIZE) {
      break;
    }
  }

  if (fixtures.length === 0) {
    console.log("[runPredictionsWindow] done", {
      durationMs: Date.now() - startedAtMs,
      pagesRead,
      fixturesInScope: 0,
      candidates: 0,
      missingFeatures: 0,
      batchesAttempted: 0,
      batchesFailed: 0,
      predictionsReturned: 0,
      qualified: 0,
      highlightedTopN: 0,
      staleHighlightedReset: 0,
    });
    return;
  }

  const fixtureById = new Map<string, any>();
  for (const f of fixtures) {
    fixtureById.set(String(f.id ?? f.docId), f);
  }

  const hasFeatures = (f: any) => !!(f.features ?? f.featuresV2);

  const candidates = fixtures
    .map((f) => ({
      fixtureId: String(f.id ?? f.docId),
      features: f.features ?? f.featuresV2,
    }))
    .filter((x) => !!x.features);

  const missingFeatures = fixtures.length - candidates.length;

  if (candidates.length === 0) {
    console.log("[runPredictionsWindow] done", {
      durationMs: Date.now() - startedAtMs,
      pagesRead,
      fixturesInScope: fixtures.length,
      candidates: 0,
      missingFeatures,
      batchesAttempted: 0,
      batchesFailed: 0,
      predictionsReturned: 0,
      qualified: 0,
      highlightedTopN: 0,
      staleHighlightedReset: 0,
    });
    return;
  }

  const baseUrl = ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/predictBatch`;

  let batchesAttempted = 0;
  let batchesFailed = 0;
  let predictionsReturned = 0;
  let qualifiedCount = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batchesAttempted++;
    const slice = candidates.slice(i, i + BATCH_SIZE);

    const payload: PredictBatchRequest = {
      modelVersion,
      items: slice,
    };

    let json: PredictBatchResponse;
    try {
      json = await postPredictBatch(url, payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Cloud Run request failed: ${msg}`);
      batchesFailed++;
      continue;
    }

    predictionsReturned += json.predictions.length;

    let writeBatch = db.batch();
    let ops = 0;

    for (const p of json.predictions) {
      const fixtureId = String(p.fixtureId);

      const predRef = db.collection("predictions_live").doc(fixtureId);
      const detailsRef = db.collection("fixture_details").doc(fixtureId);

      const meta = computeHighlightMeta(p);

      const bttsY = p.btts?.Y ?? 0;
      const overY = p.over25?.Y ?? 0;

      const bttsYOk = p.btts?.pick === "Y" && bttsY >= BTTS_HIGHLIGHT_MIN;
      const overYOk = p.over25?.pick === "Y" && overY >= OVER25_HIGHLIGHT_MIN;

      const goalsPick: {
        kind: "btts" | "over25";
        pick: "Y";
        prob: number;
      } | null =
        bttsYOk || overYOk
          ? overYOk && (!bttsYOk || overY >= bttsY)
            ? { kind: "over25", pick: "Y", prob: overY }
            : { kind: "btts", pick: "Y", prob: bttsY }
          : null;

      const fav = pickedResultProb(p);
      const gap = resultGap(p);
      const favQualified = fav >= RESULT_HIGHLIGHT_MIN && gap >= RESULT_GAP_MIN;

      const qualified = favQualified || !!goalsPick;
      if (qualified) {
        qualifiedCount++;
      }

      const fx = fixtureById.get(fixtureId);
      const market: MarketProbs1x2 | null =
        (fx?.odds?.market1x2?.marketProbs as MarketProbs1x2 | null) ?? null;

      const INTERESTING_THRESHOLD = 0.08; // 8pp
      const MAX_OVERROUND = 1.18;

      const modelH = clampProbability(p.matchResult?.H);
      const modelD = clampProbability(p.matchResult?.D);
      const modelA = clampProbability(p.matchResult?.A);

      const canUseMarket =
        !!market &&
        isFiniteNum(market.home) &&
        isFiniteNum(market.draw) &&
        isFiniteNum(market.away) &&
        isFiniteNum(market.overround) &&
        market.overround > 0 &&
        market.overround <= MAX_OVERROUND;

      const deltaHome = canUseMarket ? modelH - market.home : null;
      const deltaDraw = canUseMarket ? modelD - market.draw : null;
      const deltaAway = canUseMarket ? modelA - market.away : null;

      const best = canUseMarket
        ? [
            { key: "home" as const, delta: deltaHome! },
            { key: "draw" as const, delta: deltaDraw! },
            { key: "away" as const, delta: deltaAway! },
          ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
        : null;

      const interesting =
        !favQualified &&
        !!best &&
        Math.abs(best.delta) >= INTERESTING_THRESHOLD;

      const interestingMeta = interesting
        ? {
            bestKey: best!.key,
            bestDelta: best!.delta,
            deltaHome,
            deltaDraw,
            deltaAway,
            threshold: INTERESTING_THRESHOLD,
            overround: market!.overround,
          }
        : null;

      const tags = {
        clearFavourite: favQualified,
        goals: !!goalsPick,
        interesting,
      };

      const predictionBlock = {
        modelVersion: json.modelVersion,
        matchResult: p.matchResult,
        over25: p.over25 ?? null,
        btts: p.btts ?? null,
        resultExplain: p.resultExplain ?? null,
        resultBias: p.resultBias ?? null,

        qualified,
        goalsPick,

        resultGap: gap,
        highlightScore: meta.highlightScore,
        highlightReason: meta.highlightReason,
        highlighted: false,
        tags,
        interestingMeta,

        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // predictions_live (raw)
      writeBatch.set(
        predRef,
        { fixtureId, ...predictionBlock },
        { merge: true },
      );
      ops++;

      // fixture_details (UI doc)
      writeBatch.set(
        detailsRef,
        {
          fixtureId,
          prediction: predictionBlock,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      ops++;

      if (ops >= 450) {
        await writeBatch.commit();
        writeBatch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) await writeBatch.commit();
  }

  const fixtureIdsInScope = fixtures
    .filter(hasFeatures)
    .map((f) => String(f.id ?? f.docId));

  const predDocs: Array<admin.firestore.QueryDocumentSnapshot> = [];
  for (const ids of chunk(fixtureIdsInScope, 10)) {
    const pq = await db
      .collection("predictions_live")
      .where(admin.firestore.FieldPath.documentId(), "in", ids)
      .get();
    predDocs.push(...pq.docs);
  }

  const scored = predDocs
    .map((d) => {
      const data = d.data() as any;
      return {
        ref: d.ref,
        fixtureId: d.id,
        score: Number(data.highlightScore ?? 0),
        qualified: Boolean(data.qualified),
      };
    })
    .filter((x) => x.qualified)
    .sort((a, b) => b.score - a.score);

  const top8Summary = scored.slice(0, HIGHLIGHT_TOP_N).map((x) => {
    const fx = fixtureById.get(x.fixtureId);
    return {
      fixtureId: x.fixtureId,
      score: Number(x.score.toFixed(4)),
      homeTeamId: fx?.homeTeamId ?? null,
      awayTeamId: fx?.awayTeamId ?? null,
      leagueId: fx?.leagueId ?? null,
      kickoffTs: fx?.startingAtTimestamp ?? null,
    };
  });

  const predById = new Map<string, any>(
    predDocs.map((d) => [d.id, d.data() as any]),
  );

  const highlightedExplainTop3 = scored.slice(0, HIGHLIGHT_TOP_N).map((x) => {
    const data = predById.get(x.fixtureId) ?? {};
    const explainRows = Array.isArray(data.resultExplain)
      ? data.resultExplain
      : [];

    const top3 = explainRows
      .filter(
        (row: any) =>
          row &&
          typeof row.feature === "string" &&
          Number.isFinite(Number(row.contribution)),
      )
      .sort(
        (a: any, b: any) =>
          Math.abs(Number(b.contribution)) - Math.abs(Number(a.contribution)),
      )
      .slice(0, 3)
      .map((row: any) => ({
        feature: row.feature,
        contribution: Number(Number(row.contribution).toFixed(5)),
      }));

    return {
      fixtureId: x.fixtureId,
      resultPick: data?.matchResult?.pick ?? null,
      highlightReason: data?.highlightReason ?? null,
      top3,
    };
  });

  const teamFreq = new Map<number, number>();
  for (const row of scored.slice(0, 20)) {
    const fx = fixtureById.get(row.fixtureId);
    const homeTeamId = Number(fx?.homeTeamId);
    const awayTeamId = Number(fx?.awayTeamId);

    if (Number.isFinite(homeTeamId)) {
      teamFreq.set(homeTeamId, (teamFreq.get(homeTeamId) ?? 0) + 1);
    }
    if (Number.isFinite(awayTeamId)) {
      teamFreq.set(awayTeamId, (teamFreq.get(awayTeamId) ?? 0) + 1);
    }
  }

  const repeatedTeamsTop20 = Array.from(teamFreq.entries())
    .map(([teamId, count]) => ({ teamId, count }))
    .filter((x) => x.count > 1)
    .sort((a, b) => b.count - a.count || a.teamId - b.teamId)
    .slice(0, 12);

  const top = new Set(scored.slice(0, HIGHLIGHT_TOP_N).map((x) => x.fixtureId));

  const currentlyHighlighted = await db
    .collection("predictions_live")
    .where("highlighted", "==", true)
    .limit(500)
    .get();

  const staleHighlighted = currentlyHighlighted.docs.filter(
    (d) => !top.has(d.id),
  );

  let highlightBatch = db.batch();
  let operations = 0;

  for (const d of predDocs) {
    const fixtureId = d.id;
    const isHighlighted = top.has(fixtureId);

    highlightBatch.set(d.ref, { highlighted: isHighlighted }, { merge: true });
    operations++;

    const detailsRef = db.collection("fixture_details").doc(fixtureId);
    highlightBatch.set(
      detailsRef,
      { "prediction.highlighted": isHighlighted },
      { merge: true },
    );
    operations++;

    if (operations >= 450) {
      await highlightBatch.commit();
      highlightBatch = db.batch();
      operations = 0;
    }
  }

  for (const d of staleHighlighted) {
    highlightBatch.set(d.ref, { highlighted: false }, { merge: true });
    operations++;

    const detailsRef = db.collection("fixture_details").doc(d.id);
    highlightBatch.set(
      detailsRef,
      { "prediction.highlighted": false },
      { merge: true },
    );
    operations++;

    if (operations >= 450) {
      await highlightBatch.commit();
      highlightBatch = db.batch();
      operations = 0;
    }
  }

  if (operations > 0) await highlightBatch.commit();

  console.log(
    "[runPredictionsWindow] highlightedExplainTop3",
    JSON.stringify(highlightedExplainTop3),
  );

  console.log("[runPredictionsWindow] done", {
    durationMs: Date.now() - startedAtMs,
    pagesRead,
    pageSize: PAGE_SIZE,
    fixturesInScope: fixtures.length,
    candidates: candidates.length,
    missingFeatures,
    batchesAttempted,
    batchesFailed,
    predictionsReturned,
    qualified: qualifiedCount,
    highlightedTopN: top.size,
    staleHighlightedReset: staleHighlighted.length,
    top8Summary,
    highlightedExplainTop3,
    repeatedTeamsTop20,
  });
};
