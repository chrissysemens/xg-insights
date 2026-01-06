import os
import numpy as np
from fastapi import FastAPI, HTTPException
from pathlib import Path
from app.schemas import PredictBatchRequest, PredictBatchResponse, PredictionOut, MatchResultOut, BinaryOut
from app.feature_flatten import build_matrix
from app.models import ModelBundle

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"

OVER25_THRESHOLD = float(os.getenv("OVER25_THRESHOLD", "0.535"))
BTTS_THRESHOLD = float(os.getenv("BTTS_THRESHOLD", "0.535"))

app = FastAPI(title="Football Predictor", version="1.0.0")

bundle: ModelBundle | None = None
bundle_error: str | None = None


@app.on_event("startup")
def startup():
    global bundle, bundle_error
    try:
        bundle = ModelBundle()
        bundle_error = None
        print("Startup OK: models loaded")
        print("Thresholds:", {"over25": OVER25_THRESHOLD, "btts": BTTS_THRESHOLD})
    except Exception as e:
        bundle = None
        bundle_error = f"{type(e).__name__}: {e}"
        print(f"Startup WARNING: models not loaded: {bundle_error}")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/predictBatch", response_model=PredictBatchResponse)
def predict_batch(req: PredictBatchRequest):
    if bundle is None:
        raise HTTPException(status_code=503, detail=f"Models not loaded: {bundle_error}")

    feats = [it.features for it in req.items]
    X = build_matrix(feats, bundle.feature_names)

    pr = bundle.predict_result(X)  # (n,3)
    p_over = bundle.predict_binary(bundle.over25, X)  # (n,)
    p_btts = bundle.predict_binary(bundle.btts, X)    # (n,)

    # quick telemetry
    if len(req.items) > 0:
        over_arr = np.asarray(p_over, dtype=float)
        btts_arr = np.asarray(p_btts, dtype=float)
        print("Probs:", {
            "over25": {"min": float(over_arr.min()), "mean": float(over_arr.mean()), "max": float(over_arr.max())},
            "btts": {"min": float(btts_arr.min()), "mean": float(btts_arr.mean()), "max": float(btts_arr.max())},
        })

    preds: list[PredictionOut] = []
    for i, it in enumerate(req.items):
        pH, pD, pA = float(pr[i, 0]), float(pr[i, 1]), float(pr[i, 2])

        pick = "H"
        if pD > pH and pD >= pA:
            pick = "D"
        elif pA > pH and pA > pD:
            pick = "A"

        match_out = MatchResultOut(H=pH, D=pD, A=pA, pick=pick)

        over_y = float(p_over[i])
        over_out = BinaryOut(
            Y=over_y,
            N=float(1.0 - over_y),
            pick=("Y" if over_y >= OVER25_THRESHOLD else "N"),
        )

        btts_y = float(p_btts[i])
        btts_out = BinaryOut(
            Y=btts_y,
            N=float(1.0 - btts_y),
            pick=("Y" if btts_y >= BTTS_THRESHOLD else "N"),
        )

        preds.append(PredictionOut(
            fixtureId=it.fixtureId,
            matchResult=match_out,
            over25=over_out,
            btts=btts_out,
        ))

    return PredictBatchResponse(modelVersion=req.modelVersion, predictions=preds)
