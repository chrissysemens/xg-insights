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
function computeHighlightScore(p) {
    const resultMax = Math.max(p.matchResult.H ?? 0, p.matchResult.D ?? 0, p.matchResult.A ?? 0);
    const overY = p.over25?.Y ?? 0;
    const bttsY = p.btts?.Y ?? 0;
    return Math.max(resultMax, overY, bttsY);
}
function computeHighlightReason(p) {
    const resultMax = Math.max(p.matchResult.H ?? 0, p.matchResult.D ?? 0, p.matchResult.A ?? 0);
    const overY = p.over25?.Y ?? 0;
    const bttsY = p.btts?.Y ?? 0;
    const best = Math.max(resultMax, overY, bttsY);
    if (best === overY)
        return HighlightReason.HIGH_GOALS;
    if (best === bttsY)
        return HighlightReason.BTTS_LIKELY;
    return HighlightReason.CLEAR_FAVOURITE;
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
    const db = admin.firestore();
    // Scope: in-window + not started + enriched
    const qs = await db
        .collection("fixtures_live")
        .where("inWindow", "==", true)
        .where("state.shortName", "==", "NS")
        .orderBy("startingAtTimestamp", "asc")
        .limit(200)
        .get();
    const fixtures = qs.docs.map((d) => ({ docId: d.id, ...d.data() }));
    const total = fixtures.length;
    const withFeatures = fixtures.filter((f) => !!f.features).length;
    console.log(`Prediction scope: total=${total}, withFeatures=${withFeatures}, missingFeatures=${total - withFeatures}`);
    const candidates = fixtures
        .filter((f) => !!f.features)
        .map((f) => ({
        fixtureId: String(f.id ?? f.docId),
        features: f.features,
    }));
    console.log(`Prediction candidates: ${candidates.length}`);
    if (candidates.length === 0) {
        console.warn("runPredictionsWindow: no candidates (likely enrichment not run)");
        return;
    }
    console.log(`Prediction candidates: ${candidates.length}`);
    if (candidates.length === 0)
        return;
    const baseUrl = config_1.ENV.PREDICTOR.BASE_URL.replace(/\/+$/, "");
    const url = `${baseUrl}/predictBatch`;
    // --- 1) Run prediction batches & write predictions with highlightScore/reason + highlighted=false ---
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const slice = candidates.slice(i, i + BATCH_SIZE);
        const payload = {
            modelVersion: config_1.ENV.PREDICTOR.MODEL_VERSION,
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
            const predRef = db
                .collection("predictions_live")
                .doc(String(p.fixtureId));
            const highlightScore = computeHighlightScore(p);
            const highlightReason = computeHighlightReason(p);
            batch.set(predRef, {
                fixtureId: String(p.fixtureId),
                modelVersion: json.modelVersion,
                matchResult: p.matchResult,
                over25: p.over25 ?? null,
                btts: p.btts ?? null,
                highlightScore,
                highlightReason, // enum value
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
        console.log(`Wrote predictions for batch ${i / BATCH_SIZE + 1} (${slice.length} fixtures)`);
    }
    // --- 2) Select top N highlights across the same in-window fixtures and update highlighted flags ---
    const fixtureIdsInScope = fixtures
        .filter((f) => !!f.features)
        .map((f) => String(f.id ?? f.docId));
    // Fetch predictions by doc id using "in" chunks (Firestore max 10)
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