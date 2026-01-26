import * as admin from "firebase-admin";
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

export const runPredictionsWindow = async () => {
  if (!ENV.PREDICTOR.BASE_URL) {
    throw new Error("Missing ENV.PREDICTOR.BASE_URL");
  }

  const modelVersion = ENV.PREDICTOR.MODEL_VERSION;
  const db = admin.firestore();

  const qs = await db
    .collection("fixtures_live")
    .where("inWindow", "==", true)
    .where("state.shortName", "==", "NS")
    .orderBy("startingAtTimestamp", "asc")
    .limit(200)
    .get();

  const fixtures = qs.docs.map((d) => ({ docId: d.id, ...(d.data() as any) }));

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

  if (candidates.length === 0) return;

  const baseUrl = ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/predictBatch`;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const slice = candidates.slice(i, i + BATCH_SIZE);

    const payload: PredictBatchRequest = {
      modelVersion,
      items: slice,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Cloud Run error ${res.status}: ${text.slice(0, 500)}`);
      continue;
    }

    const json = (await res.json()) as PredictBatchResponse;

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

  const top = new Set(scored.slice(0, HIGHLIGHT_TOP_N).map((x) => x.fixtureId));

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

  if (operations > 0) await highlightBatch.commit();
};
