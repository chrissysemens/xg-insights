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
 * @return {*} - void
 */
export async function evaluateArchivedPredictionsWindow() {
  const db = admin.firestore();

  const snap = await db
    .collection("fixtures_archive")
    .where("stateShortName", "==", "FT")
    .where("evaluationDone", "==", false)
    .limit(200)
    .get();

  if (snap.empty) {
    // No work to do
    return;
  }

  const fixtureIds = snap.docs.map((d) => d.id);

  // Predictions are stored by fixtureId (doc id) in predictions_live
  const predRefs = fixtureIds.map((id) =>
    db.collection("predictions_live").doc(id),
  );
  const predSnaps = await db.getAll(...predRefs);

  const predsById = new Map<string, FirebaseFirestore.DocumentData>();
  predSnaps.forEach((s) => {
    if (s.exists) predsById.set(s.id, s.data()!);
  });

  let batch = db.batch();
  let operations = 0;

  for (const fxDoc of snap.docs) {
    const fx = fxDoc.data() as any;
    const fixtureId = fxDoc.id;

    const pred = predsById.get(fixtureId);
    const score = extractFinalScoreFromFixture(fx);

    // If we can’t evaluate, record why (and allow retry later)
    if (!score) {
      batch.update(fxDoc.ref, {
        evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationError: "MISSING_FINAL_SCORE",
      });
      operations++;
      continue;
    }

    if (!pred) {
      batch.update(fxDoc.ref, {
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

    const predBtts = pred?.btts?.pick as Pick | undefined;
    const predOver = pred?.over25?.pick as Pick | undefined;
    const predRes = pred?.matchResult?.pick as ResultPick | undefined;

    const correct = {
      btts: !!predBtts && predBtts === actualBtts,
      over25: !!predOver && predOver === actualOver,
      result: !!predRes && predRes === actualRes,
    };

    const scoreCount = [correct.btts, correct.over25, correct.result].filter(
      Boolean,
    ).length;

    batch.update(fxDoc.ref, {
      evaluationDone: true,
      evaluationError: admin.firestore.FieldValue.delete(),
      evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      evaluation: {
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelVersion: pred.modelVersion ?? null,

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

    // Firestore batch limit is 500 writes, keep margin
    if (operations >= 450) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  }

  if (operations > 0) await batch.commit();
}
