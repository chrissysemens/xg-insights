import * as admin from "firebase-admin";
import { Pick, ResultPick } from "../types";
import {
  actualBTTS,
  actualOver25,
  actualResult,
  extractFinalScoreFromFixture,
} from "../utils/helpers";

/**
 * Writes evaluation data for finished fixtures (measure accuracy).
 *
 * Notes:
 * - Marks evaluationDone=true even for permanent failures (missing score/pred doc)
 *   so we don't re-process the same fixture forever.
 * - Supports predictions stored in either:
 *    - predictions_live/{fixtureId}
 *    - fixture_details/{fixtureId}.prediction (fallback)
 */
export async function evaluateArchivedPredictionsWindow() {
  const startedAtMs = Date.now();
  const db = admin.firestore();

  const finishedStates = ["FT", "AET", "PEN"] as const;
  const stateSnaps = await Promise.all(
    finishedStates.map((state) =>
      db
        .collection("fixtures_archive")
        .where("stateShortName", "==", state)
        .where("evaluationDone", "==", false)
        .limit(200)
        .get(),
    ),
  );

  const byId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const s of stateSnaps) {
    for (const d of s.docs) {
      byId.set(d.id, d);
    }
  }

  const docs = Array.from(byId.values()).slice(0, 200);

  if (docs.length === 0) {
    console.log("[evaluateArchivedPredictionsWindow] done", {
      durationMs: Date.now() - startedAtMs,
      candidates: 0,
      evaluated: 0,
      missingScore: 0,
      missingPrediction: 0,
      accuracy: {
        result: null,
        over25: null,
        btts: null,
      },
    });
    return;
  }

  const fixtureIds = docs.map((d) => d.id);

  // --- Fetch predictions (primary: predictions_live) ---
  const predRefs = fixtureIds.map((id) =>
    db.collection("predictions_live").doc(id),
  );
  const predSnaps = await db.getAll(...predRefs);

  const predsById = new Map<string, FirebaseFirestore.DocumentData>();
  predSnaps.forEach((s) => {
    if (s.exists) predsById.set(s.id, s.data()!);
  });

  const missingPredIds = fixtureIds.filter((id) => !predsById.has(id));
  if (missingPredIds.length) {
    const detailRefs = missingPredIds.map((id) =>
      db.collection("fixture_details").doc(id),
    );
    const detailSnaps = await db.getAll(...detailRefs);

    detailSnaps.forEach((s) => {
      if (!s.exists) return;
      const data = s.data() as any;
      if (data?.prediction) {
        predsById.set(s.id, data.prediction);
      }
    });
  }

  let batch = db.batch();
  let operations = 0;

  let evaluated = 0;
  let missingScore = 0;
  let missingPrediction = 0;
  let correctResult = 0;
  let correctOver25 = 0;
  let correctBtts = 0;

  for (const fxDoc of docs) {
    const fx = fxDoc.data() as any;
    const fixtureId = fxDoc.id;

    const pred = predsById.get(fixtureId);
    const score = extractFinalScoreFromFixture(fx);

    // Permanent failure: no final score
    if (!score) {
      missingScore++;
      batch.update(fxDoc.ref, {
        evaluationDone: true,
        evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationError: "MISSING_FINAL_SCORE",
      });
      operations++;
      continue;
    }

    // Permanent failure: no prediction doc anywhere
    if (!pred) {
      missingPrediction++;
      batch.update(fxDoc.ref, {
        evaluationDone: true,
        evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationError: "MISSING_PREDICTION_DOC",
      });
      operations++;
      continue;
    }

    const { hg, ag } = score;

    const actualBtts = actualBTTS(hg, ag);
    const actualOver = actualOver25(hg, ag);
    const actualRes = actualResult(hg, ag);

    // Defensive pick reads (support a few possible doc shapes)
    const predBtts = (pred?.btts?.pick ?? pred?.prediction?.btts?.pick) as
      | Pick
      | undefined;
    const predOver = (pred?.over25?.pick ?? pred?.prediction?.over25?.pick) as
      | Pick
      | undefined;
    const predRes = (pred?.matchResult?.pick ??
      pred?.prediction?.matchResult?.pick) as ResultPick | undefined;

    // Keep your existing semantics:
    // - missing pick => incorrect (false)
    const correct = {
      btts: !!predBtts && predBtts === actualBtts,
      over25: !!predOver && predOver === actualOver,
      result: !!predRes && predRes === actualRes,
    };

    evaluated++;
    if (correct.result) correctResult++;
    if (correct.over25) correctOver25++;
    if (correct.btts) correctBtts++;

    const scoreCount = [correct.btts, correct.over25, correct.result].filter(
      Boolean,
    ).length;

    batch.update(fxDoc.ref, {
      evaluationDone: true,
      evaluationError: admin.firestore.FieldValue.delete(),
      evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      evaluation: {
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelVersion:
          pred?.modelVersion ?? pred?.prediction?.modelVersion ?? null,

        actual: {
          hg,
          ag,
          btts: actualBtts,
          over25: actualOver,
          result: actualRes,
        },
        predicted: {
          bttsPick: predBtts ?? null,
          over25Pick: predOver ?? null,
          resultPick: predRes ?? null,
        },
        correct,
        score: scoreCount,
      },
    });

    operations++;

    // Firestore limit is 500 ops/batch. Keep a buffer.
    if (operations >= 450) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  }

  if (operations > 0) await batch.commit();

  const safeRate = (num: number, den: number) =>
    den > 0 ? Number((num / den).toFixed(4)) : null;

  console.log("[evaluateArchivedPredictionsWindow] done", {
    durationMs: Date.now() - startedAtMs,
    candidates: docs.length,
    evaluated,
    missingScore,
    missingPrediction,
    accuracy: {
      result: safeRate(correctResult, evaluated),
      over25: safeRate(correctOver25, evaluated),
      btts: safeRate(correctBtts, evaluated),
    },
  });
}
