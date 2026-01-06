import * as admin from "firebase-admin";

type Pick = "Y" | "N";
type ResultPick = "H" | "D" | "A";

function actualResult(hg: number, ag: number): ResultPick {
  if (hg > ag) return "H";
  if (hg < ag) return "A";
  return "D";
}
function actualBTTS(hg: number, ag: number): Pick {
  return hg > 0 && ag > 0 ? "Y" : "N";
}
function actualOver25(hg: number, ag: number): Pick {
  return hg + ag >= 3 ? "Y" : "N";
}

/**
 * Adjust this once you confirm where your archived fixture stores the final score.
 * I’ve included a few common patterns.
 */
function extractFinalScore(fx: any): { hg: number; ag: number } | null {
  // Pattern A: direct
  if (fx.homeGoals != null && fx.awayGoals != null) {
    return { hg: Number(fx.homeGoals), ag: Number(fx.awayGoals) };
  }

  // Pattern B: nested "scores"
  if (fx.scores?.home != null && fx.scores?.away != null) {
    return { hg: Number(fx.scores.home), ag: Number(fx.scores.away) };
  }

  // Pattern C: SportsMonks-ish shapes vary by endpoint
  if (fx.scores?.localteam_score != null && fx.scores?.visitorteam_score != null) {
    return { hg: Number(fx.scores.localteam_score), ag: Number(fx.scores.visitorteam_score) };
  }

  return null;
}

export async function evaluateArchivedPredictionsWindow() {
  const db = admin.firestore();

  // Prefer denormalised fields for easy querying:
  // - stateShortName: "FT"
  // - evaluationDone: false
  const snap = await db
    .collection("fixtures_archive")
    .where("stateShortName", "==", "FT")
    .where("evaluationDone", "==", false)
    .limit(200)
    .get();

  if (snap.empty) {
    console.log("evaluateArchivedPredictions: nothing to do");
    return;
  }

  const fixtureIds = snap.docs.map((d) => d.id);

  // Predictions are stored by fixtureId (doc id) in predictions_live
  const predRefs = fixtureIds.map((id) => db.collection("predictions_live").doc(id));
  const predSnaps = await db.getAll(...predRefs);

  const predsById = new Map<string, FirebaseFirestore.DocumentData>();
  predSnaps.forEach((s) => {
    if (s.exists) predsById.set(s.id, s.data()!);
  });

  let batch = db.batch();
  let ops = 0;

  for (const fxDoc of snap.docs) {
    const fx = fxDoc.data() as any;
    const fixtureId = fxDoc.id;

    const pred = predsById.get(fixtureId);
    const score = extractFinalScore(fx);

    // If we can’t evaluate, record why (and allow retry later)
    if (!score) {
      batch.update(fxDoc.ref, {
        evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationError: "MISSING_FINAL_SCORE",
      });
      ops++;
      continue;
    }

    if (!pred) {
      batch.update(fxDoc.ref, {
        evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationError: "MISSING_PREDICTION_DOC",
      });
      ops++;
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

    const scoreCount = [correct.btts, correct.over25, correct.result].filter(Boolean).length;

    batch.update(fxDoc.ref, {
      evaluationDone: true,
      evaluationError: admin.firestore.FieldValue.delete(),
      evaluationLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      evaluation: {
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelVersion: pred.modelVersion ?? null,

        actual: { hg, ag, btts: actualBtts, over25: actualOver, result: actualRes },
        predicted: { bttsPick: predBtts ?? null, over25Pick: predOver ?? null, resultPick: predRes ?? null },
        correct,
        score: scoreCount,
      },
    });

    ops++;

    // Firestore batch limit is 500 writes, keep margin
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();

  console.log(`evaluateArchivedPredictions: processed ${snap.size} fixtures`);
}
