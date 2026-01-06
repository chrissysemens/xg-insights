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
exports.HighlightReason = void 0;
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
// Keep these aligned with your predictor thresholds (or slightly higher)
const BTTS_HIGHLIGHT_MIN = 0.62;
const OVER25_HIGHLIGHT_MIN = 0.55;
const RESULT_HIGHLIGHT_MIN = 0.48;
function pickedResultProb(p) {
    const pick = p.matchResult.pick;
    if (pick === "H")
        return p.matchResult.H ?? 0;
    if (pick === "D")
        return p.matchResult.D ?? 0;
    return p.matchResult.A ?? 0;
}
function computeHighlightMeta(p) {
    const candidates = [];
    // BTTS highlight only if pick is YES and prob is strong
    const bttsY = p.btts?.Y ?? 0;
    if (p.btts?.pick === "Y" && bttsY >= BTTS_HIGHLIGHT_MIN) {
        candidates.push({ reason: HighlightReason.BTTS_LIKELY, score: bttsY });
    }
    // Over2.5 highlight only if pick is YES and prob is strong
    const overY = p.over25?.Y ?? 0;
    if (p.over25?.pick === "Y" && overY >= OVER25_HIGHLIGHT_MIN) {
        candidates.push({ reason: HighlightReason.HIGH_GOALS, score: overY });
    }
    // Favourite highlight based on the picked result prob
    const fav = pickedResultProb(p);
    if (fav >= RESULT_HIGHLIGHT_MIN) {
        candidates.push({ reason: HighlightReason.CLEAR_FAVOURITE, score: fav });
    }
    // Fallback: always use favourite if nothing qualified
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
    // Scope: in-window + not started + enriched (v2)
    const qs = await db
        .collection("fixtures_live")
        .where("inWindow", "==", true)
        .where("state.shortName", "==", "NS")
        .orderBy("startingAtTimestamp", "asc")
        .limit(200)
        .get();
    const fixtures = qs.docs.map((d) => ({ docId: d.id, ...d.data() }));
    const total = fixtures.length;
    const withFeaturesV2 = fixtures.filter((f) => !!f.featuresV2).length;
    console.log(`Prediction scope: total=${total}, withFeaturesV2=${withFeaturesV2}, missingFeaturesV2=${total - withFeaturesV2}`);
    const candidates = fixtures
        .filter((f) => !!f.featuresV2)
        .map((f) => ({
        fixtureId: String(f.id ?? f.docId),
        features: f.featuresV2,
    }));
    console.log(`Prediction candidates: ${candidates.length}`);
    if (candidates.length === 0) {
        console.warn("runPredictionsWindow: no candidates (likely enrichment not run)");
        return;
    }
    const baseUrl = config_1.ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
    const url = `${baseUrl}/predictBatch`;
    // --- 1) Run prediction batches & write predictions with highlightScore/reason + highlighted=false ---
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
            const predRef = db.collection("predictions_live").doc(String(p.fixtureId));
            const meta = computeHighlightMeta(p);
            batch.set(predRef, {
                fixtureId: String(p.fixtureId),
                modelVersion: json.modelVersion,
                matchResult: p.matchResult,
                over25: p.over25 ?? null,
                btts: p.btts ?? null,
                highlightScore: meta.highlightScore,
                highlightReason: meta.highlightReason,
                highlighted: false, // set later for top N
                generatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    // --- 2) Select top N highlights across the same in-window fixtures and update highlighted flags ---
    const fixtureIdsInScope = fixtures
        .filter((f) => !!f.featuresV2)
        .map((f) => String(f.id ?? f.docId));
    const predDocs = [];
    for (const ids of chunk(fixtureIdsInScope, 10)) {
        const pq = await db
            .collection("predictions_live")
            .where(admin.firestore.FieldPath.documentId(), "in", ids)
            .get();
        predDocs.push(...pq.docs);
    }
    const scored = predDocs
        .map((d) => {
        const data = d.data();
        return {
            ref: d.ref,
            fixtureId: d.id,
            score: Number(data.highlightScore ?? 0),
        };
    })
        .sort((a, b) => b.score - a.score);
    const top = new Set(scored.slice(0, HIGHLIGHT_TOP_N).map((x) => x.fixtureId));
    let batch2 = db.batch();
    let ops2 = 0;
    for (const s of scored) {
        batch2.set(s.ref, { highlighted: top.has(s.fixtureId) }, { merge: true });
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