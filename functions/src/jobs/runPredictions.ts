import * as admin from "firebase-admin";
import { ENV } from "../config";
import {
  PredictBatchRequest,
  PredictBatchResponse,
} from "../types";
import { chunk, computeHighlightMeta, pickedResultProb, resultGap } from "../utils/helpers";
import {
  BTTS_HIGHLIGHT_MIN,
  OVER25_HIGHLIGHT_MIN,
  RESULT_GAP_MIN,
  RESULT_HIGHLIGHT_MIN,
} from "../consts";

const BATCH_SIZE = 50;
const HIGHLIGHT_TOP_N = 8;

export const runPredictionsWindow = async () => {
  if (!ENV.PREDICTOR.BASE_URL) {
    throw new Error("Missing ENV.PREDICTOR.BASE_URL");
  }

  const modelVersion = ENV.PREDICTOR.MODEL_VERSION;
  const db = admin.firestore();

  // Scope: in-window + not started
  const qs = await db
    .collection("fixtures_live")
    .where("inWindow", "==", true)
    .where("state.shortName", "==", "NS")
    .orderBy("startingAtTimestamp", "asc")
    .limit(200)
    .get();

  const fixtures = qs.docs.map((d) => ({ docId: d.id, ...(d.data() as any) }));

  const hasFeatures = (f: any) => !!(f.features ?? f.featuresV2);

  const candidates = fixtures
    .map((f) => ({
      fixtureId: String(f.id ?? f.docId),
      features: f.features ?? f.featuresV2,
    }))
    .filter((x) => !!x.features);

  if (candidates.length === 0) {
    // No work to do
    return;
  }

  const baseUrl = ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/predictBatch`;

  // Run predictions in batches
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

      // Compute highlight flags:  ClearWinner and (BTTS OR Over2.5)
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

      // Clear favourite if MIN + GAP are met
      const fav = pickedResultProb(p);
      const gap = resultGap(p);
      const favQualified = fav >= RESULT_HIGHLIGHT_MIN && gap >= RESULT_GAP_MIN;

      // Qualified: If a goals badge qualifies OR a genuinely clear favourite qualifies
      const qualified = favQualified || !!goalsPick;

      const predictionBlock = {
        modelVersion: json.modelVersion,
        matchResult: p.matchResult,
        over25: p.over25 ?? null,
        btts: p.btts ?? null,
        qualified, // For UI filtering
        goalsPick, // UI badge info
        resultGap: gap,
        highlightScore: meta.highlightScore,
        highlightReason: meta.highlightReason,
        highlighted: false, // updated later
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Write into predictions_live (raw data)
      writeBatch.set(
        predRef,
        {
          fixtureId,
          ...predictionBlock,
        },
        { merge: true },
      );
      ops++;

      // Also write into fixture_details (denormalised for UI)
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

  // Select top N highlights and update highlighted flags in BOTH places ---
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

  // Only allow qualified picks to compete for "top N"
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

  // Write highlighted false for all other docs
  const allInScope = predDocs.map((d) => ({ ref: d.ref, fixtureId: d.id }));

  for (const s of allInScope) {
    const isHighlighted = top.has(s.fixtureId);

    // predictions_live
    highlightBatch.set(s.ref, { highlighted: isHighlighted }, { merge: true });
    operations++;

    // fixture_details mirror flag
    const detailsRef = db.collection("fixture_details").doc(s.fixtureId);
    highlightBatch.set(
      detailsRef,
      { prediction: { highlighted: isHighlighted } },
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
}
