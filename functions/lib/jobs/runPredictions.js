"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTTS_HIGHLIGHT_MIN = exports.OVER25_HIGHLIGHT_MIN = exports.RESULT_GAP_MIN = exports.RESULT_HIGHLIGHT_MIN = exports.HighlightReason = void 0;
exports.runPredictionsWindow = runPredictionsWindow;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
var HighlightReason;
(function (HighlightReason) {
    HighlightReason["HIGH_GOALS"] = "HIGH_GOALS";
    HighlightReason["BTTS_LIKELY"] = "BTTS_LIKELY";
    HighlightReason["CLEAR_FAVOURITE"] = "CLEAR_FAVOURITE";
})(HighlightReason || (exports.HighlightReason = HighlightReason = {}));
const BATCH_SIZE = 50;
const HIGHLIGHT_TOP_N = 8;
exports.RESULT_HIGHLIGHT_MIN = 0.52;
exports.RESULT_GAP_MIN = 0.1;
exports.OVER25_HIGHLIGHT_MIN = 0.61;
exports.BTTS_HIGHLIGHT_MIN = 0.54;
function pickedResultProb(p) {
    const pick = p.matchResult.pick;
    if (pick === "H")
        return p.matchResult.H ?? 0;
    if (pick === "D")
        return p.matchResult.D ?? 0;
    return p.matchResult.A ?? 0;
}
/**
 * How “clear” the favourite is:
 * gap = bestProb - secondBestProb
 */
function resultGap(p) {
    const H = Number(p.matchResult.H ?? 0);
    const D = Number(p.matchResult.D ?? 0);
    const A = Number(p.matchResult.A ?? 0);
    const probs = [H, D, A].sort((a, b) => b - a);
    const best = probs[0] ?? 0;
    const second = probs[1] ?? 0;
    return Math.max(0, best - second);
}
function computeHighlightMeta(p) {
    const candidates = [];
    // --- mutually exclusive goal-type highlight (BTTS vs Over2.5) ---
    const bttsY = p.btts?.Y ?? 0;
    const overY = p.over25?.Y ?? 0;
    const bttsOk = p.btts?.pick === "Y" && bttsY >= exports.BTTS_HIGHLIGHT_MIN;
    const overOk = p.over25?.pick === "Y" && overY >= exports.OVER25_HIGHLIGHT_MIN;
    if (bttsOk || overOk) {
        // choose the stronger "Y" by probability
        if (overOk && (!bttsOk || overY >= bttsY)) {
            candidates.push({ reason: HighlightReason.HIGH_GOALS, score: overY });
        }
        else if (bttsOk) {
            candidates.push({ reason: HighlightReason.BTTS_LIKELY, score: bttsY });
        }
    }
    // Favourite highlight: must pass MIN and be clearly separated by GAP
    const fav = pickedResultProb(p);
    const gap = resultGap(p);
    if (fav >= exports.RESULT_HIGHLIGHT_MIN && gap >= exports.RESULT_GAP_MIN) {
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
function chunk(arr, size) {
    if (size <= 0)
        return [arr];
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
async function runPredictionsWindow() {
    if (!config_1.ENV.PREDICTOR.BASE_URL) {
        throw new Error("Missing ENV.PREDICTOR.BASE_URL");
    }
    const modelVersion = config_1.ENV.PREDICTOR.MODEL_VERSION;
    const db = admin.firestore();
    // Scope: in-window + not started
    const qs = await db
        .collection("fixtures_live")
        .where("inWindow", "==", true)
        .where("state.shortName", "==", "NS")
        .orderBy("startingAtTimestamp", "asc")
        .limit(200)
        .get();
    const fixtures = qs.docs.map((d) => ({ docId: d.id, ...d.data() }));
    // TEMP migration fallback: prefer `features`, fallback `featuresV2`
    const hasFeatures = (f) => !!(f.features ?? f.featuresV2);
    const total = fixtures.length;
    const withFeatures = fixtures.filter(hasFeatures).length;
    console.log(`Prediction scope: total=${total}, withFeatures=${withFeatures}, missingFeatures=${total - withFeatures}`);
    const candidates = fixtures
        .map((f) => ({
        fixtureId: String(f.id ?? f.docId),
        features: f.features ?? f.featuresV2,
    }))
        .filter((x) => !!x.features);
    console.log(`Prediction candidates: ${candidates.length}`);
    if (candidates.length === 0) {
        console.warn("runPredictionsWindow: no candidates (likely enrichment not run)");
        return;
    }
    const baseUrl = config_1.ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
    const url = `${baseUrl}/predictBatch`;
    // --- 1) Run prediction batches & write predictions_live AND merge into fixture_details ---
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const slice = candidates.slice(i, i + BATCH_SIZE);
        const payload = {
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
        const json = (await res.json());
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
            const bttsYOk = p.btts?.pick === "Y" && bttsY >= exports.BTTS_HIGHLIGHT_MIN;
            const overYOk = p.over25?.pick === "Y" && overY >= exports.OVER25_HIGHLIGHT_MIN;
            const goalsPick = bttsYOk || overYOk
                ? overYOk && (!bttsYOk || overY >= bttsY)
                    ? { kind: "over25", pick: "Y", prob: overY }
                    : { kind: "btts", pick: "Y", prob: bttsY }
                : null;
            // Favourite qualifies only if MIN + GAP are met
            const fav = pickedResultProb(p);
            const gap = resultGap(p);
            const favQualified = fav >= exports.RESULT_HIGHLIGHT_MIN && gap >= exports.RESULT_GAP_MIN;
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
            batch.set(predRef, {
                fixtureId,
                ...predictionBlock,
            }, { merge: true });
            ops++;
            // fixture_details (denormalised for UI)
            batch.set(detailsRef, {
                fixtureId,
                prediction: predictionBlock,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            ops++;
            if (ops >= 450) {
                await batch.commit();
                batch = db.batch();
                ops = 0;
            }
        }
        if (ops > 0)
            await batch.commit();
        console.log(`Wrote predictions for batch ${Math.floor(i / BATCH_SIZE) + 1} (${slice.length} fixtures)`);
    }
    // --- 2) Select top N highlights and update highlighted flags in BOTH places ---
    const fixtureIdsInScope = fixtures
        .filter(hasFeatures)
        .map((f) => String(f.id ?? f.docId));
    const predDocs = [];
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
        const data = d.data();
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
        batch2.set(detailsRef, { prediction: { highlighted: isHighlighted } }, { merge: true });
        ops2++;
        if (ops2 >= 450) {
            await batch2.commit();
            batch2 = db.batch();
            ops2 = 0;
        }
    }
    if (ops2 > 0)
        await batch2.commit();
    console.log(`Prediction run complete. Highlighted ${top.size} fixtures (top ${HIGHLIGHT_TOP_N}).`);
}
//# sourceMappingURL=runPredictions.js.map