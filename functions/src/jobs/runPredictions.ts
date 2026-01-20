import * as admin from "firebase-admin";
import { ENV } from "../config";

type PredictBatchRequest = {
  modelVersion: string;
  items: Array<{ fixtureId: string; features: any }>;
};

type PredictBatchResponse = {
  modelVersion: string;
  predictions: Array<{
    fixtureId: string;
    matchResult: { H: number; D: number; A: number; pick: "H" | "D" | "A" };
    over25?: { Y: number; N: number; pick: "Y" | "N" };
    btts?: { Y: number; N: number; pick: "Y" | "N" };
  }>;
};

export enum HighlightReason {
  HIGH_GOALS = "HIGH_GOALS",
  BTTS_LIKELY = "BTTS_LIKELY",
  CLEAR_FAVOURITE = "CLEAR_FAVOURITE",
}

const BATCH_SIZE = 50;
const HIGHLIGHT_TOP_N = 8;

// Keep these aligned with your predictor thresholds (or slightly higher)
export const RESULT_HIGHLIGHT_MIN = 0.48;
/**
 * Minimum separation between the top result prob and the 2nd-best prob.
 * Prevents “fake favourites” like H=0.46, D=0.44
 */
export const RESULT_GAP_MIN = 0.1;

export const OVER25_HIGHLIGHT_MIN = 0.6;
export const BTTS_HIGHLIGHT_MIN = 0.6;

function pickedResultProb(p: PredictBatchResponse["predictions"][number]) {
  const pick = p.matchResult.pick;
  if (pick === "H") return p.matchResult.H ?? 0;
  if (pick === "D") return p.matchResult.D ?? 0;
  return p.matchResult.A ?? 0;
}

/**
 * How “clear” the favourite is:
 * gap = bestProb - secondBestProb
 */
function resultGap(p: PredictBatchResponse["predictions"][number]) {
  const H = Number(p.matchResult.H ?? 0);
  const D = Number(p.matchResult.D ?? 0);
  const A = Number(p.matchResult.A ?? 0);

  const probs = [H, D, A].sort((a, b) => b - a);
  const best = probs[0] ?? 0;
  const second = probs[1] ?? 0;
  return Math.max(0, best - second);
}

function computeHighlightMeta(p: PredictBatchResponse["predictions"][number]) {
  const candidates: Array<{ reason: HighlightReason; score: number }> = [];

  // --- mutually exclusive goal-type highlight (BTTS vs Over2.5) ---
  const bttsY = p.btts?.Y ?? 0;
  const overY = p.over25?.Y ?? 0;

  const bttsOk = p.btts?.pick === "Y" && bttsY >= BTTS_HIGHLIGHT_MIN;
  const overOk = p.over25?.pick === "Y" && overY >= OVER25_HIGHLIGHT_MIN;

  if (bttsOk || overOk) {
    // choose the stronger "Y" by probability
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
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runPredictionsWindow() {
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

  // TEMP migration fallback: prefer `features`, fallback `featuresV2`
  const hasFeatures = (f: any) => !!(f.features ?? f.featuresV2);

  const total = fixtures.length;
  const withFeatures = fixtures.filter(hasFeatures).length;

  console.log(
    `Prediction scope: total=${total}, withFeatures=${withFeatures}, missingFeatures=${
      total - withFeatures
    }`,
  );

  const candidates = fixtures
    .map((f) => ({
      fixtureId: String(f.id ?? f.docId),
      features: f.features ?? f.featuresV2,
    }))
    .filter((x) => !!x.features);

  console.log(`Prediction candidates: ${candidates.length}`);
  if (candidates.length === 0) {
    console.warn(
      "runPredictionsWindow: no candidates (likely enrichment not run)",
    );
    return;
  }

  const baseUrl = ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/predictBatch`;

  // --- 1) Run prediction batches & write predictions_live AND merge into fixture_details ---
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

    let batch = db.batch();
    let ops = 0;

    for (const p of json.predictions) {
      const fixtureId = String(p.fixtureId);

      const predRef = db.collection("predictions_live").doc(fixtureId);
      const detailsRef = db.collection("fixture_details").doc(fixtureId);

      const meta = computeHighlightMeta(p);

      // --- compute a single goals badge (never both) ---
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

      // Favourite qualifies only if MIN + GAP are met
      const fav = pickedResultProb(p);
      const gap = resultGap(p);
      const favQualified = fav >= RESULT_HIGHLIGHT_MIN && gap >= RESULT_GAP_MIN;

      // Qualified if a goals badge qualifies OR a genuinely clear favourite qualifies
      const qualified = favQualified || !!goalsPick;

      const predictionBlock = {
        modelVersion: json.modelVersion,
        matchResult: p.matchResult,
        over25: p.over25 ?? null,
        btts: p.btts ?? null,

        qualified, // ✅ UI can filter by this
        goalsPick, // ✅ UI should use this to show ONLY one goals badge

        // useful for debugging/UI tooltips if you want later
        resultGap: gap,

        highlightScore: meta.highlightScore,
        highlightReason: meta.highlightReason,
        highlighted: false, // updated later
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // predictions_live (raw)
      batch.set(
        predRef,
        {
          fixtureId,
          ...predictionBlock,
        },
        { merge: true },
      );
      ops++;

      // fixture_details (denormalised for UI)
      batch.set(
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
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) await batch.commit();

    console.log(
      `Wrote predictions for batch ${Math.floor(i / BATCH_SIZE) + 1} (${slice.length} fixtures)`,
    );
  }

  // --- 2) Select top N highlights and update highlighted flags in BOTH places ---
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
    .filter((x) => x.qualified) // ✅ this is the key change
    .sort((a, b) => b.score - a.score);

  const top = new Set(scored.slice(0, HIGHLIGHT_TOP_N).map((x) => x.fixtureId));

  let batch2 = db.batch();
  let ops2 = 0;

  // We still need to write highlighted=false for non-top docs in scope,
  // including non-qualified docs (so UI doesn't keep stale highlights)
  const allInScope = predDocs.map((d) => ({ ref: d.ref, fixtureId: d.id }));

  for (const s of allInScope) {
    const isHighlighted = top.has(s.fixtureId);

    // predictions_live
    batch2.set(s.ref, { highlighted: isHighlighted }, { merge: true });
    ops2++;

    // fixture_details mirror flag
    const detailsRef = db.collection("fixture_details").doc(s.fixtureId);
    batch2.set(
      detailsRef,
      { prediction: { highlighted: isHighlighted } },
      { merge: true },
    );
    ops2++;

    if (ops2 >= 450) {
      await batch2.commit();
      batch2 = db.batch();
      ops2 = 0;
    }
  }

  if (ops2 > 0) await batch2.commit();

  console.log(
    `Prediction run complete. Highlighted ${top.size} fixtures (top ${HIGHLIGHT_TOP_N}).`,
  );
}
