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
exports.runPredictionsWindow = runPredictionsWindow;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const BATCH_SIZE = 50;
async function runPredictionsWindow() {
    const db = admin.firestore();
    const qs = await db
        .collection("fixtures_live")
        .where("inWindow", "==", true)
        .get();
    const candidates = qs.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((f) => f?.state?.shortName === "NS")
        .filter((f) => !!f.features); // must be enriched
    console.log(`Prediction candidates: ${candidates.length}`);
    if (candidates.length === 0)
        return;
    const baseUrl = config_1.ENV.PREDICTOR.BASE_URL;
    const url = `${baseUrl}/predictBatch`;
    // chunk into batches
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const slice = candidates.slice(i, i + BATCH_SIZE);
        const payload = {
            modelVersion: "lgbm_v1",
            items: slice.map((f) => ({
                fixtureId: String(f.id),
                features: f.features, // IMPORTANT: pass only features tree
            })),
        };
        const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error(`Cloud Run error ${res.status}: ${text.slice(0, 500)}`);
            continue; // don’t kill the whole run
        }
        const json = (await res.json());
        // write predictions
        let batch = db.batch();
        let ops = 0;
        for (const p of json.predictions) {
            const predRef = db.collection("predictions_live").doc(String(p.fixtureId));
            batch.set(predRef, {
                fixtureId: String(p.fixtureId),
                modelVersion: json.modelVersion,
                matchResult: p.matchResult,
                over25: p.over25 ?? null,
                btts: p.btts ?? null,
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
    console.log("Prediction run complete.");
}
//# sourceMappingURL=createPredictions.js.map