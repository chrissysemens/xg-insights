from fastapi import FastAPI, HTTPException
from app.schemas import (
    PredictBatchRequest,
    PredictBatchResponse,
    PredictionOut,
    MatchResultOut,
    BinaryOut,
)
from app.feature_flatten import build_matrix
from app.models import ModelBundle
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"

app = FastAPI(title="Football Predictor", version="1.0.0")

bundle: ModelBundle | None = None
bundle_error: str | None = None

import hashlib

def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


@app.on_event("startup")
def startup():
    """
    IMPORTANT: Never crash here.
    Cloud Run will kill the container if we don't start listening on PORT.
    """
    global bundle, bundle_error
    try:
        bundle = ModelBundle()
        bundle_error = None
        print("Startup OK: models loaded")
    except Exception as e:
        bundle = None
        bundle_error = f"{type(e).__name__}: {e}"
        print(f"Startup WARNING: models not loaded: {bundle_error}")


@app.get("/health")
def health():
    # Always return OK so Cloud Run health check passes
    return {"ok": True}


@app.get("/status")
def status():
    try:
        feature_path = MODEL_DIR / "feature_names.json"
        result_path = MODEL_DIR / "lgbm_result.txt"
        over25_path = MODEL_DIR / "lgbm_over25.txt"
        btts_path = MODEL_DIR / "lgbm_btts.txt"

        return {
            "modelsLoaded": bundle is not None,
            "bundleError": bundle_error,
            "featureCount": len(bundle.feature_names) if bundle else None,
            "featureNamesHash": file_hash(feature_path) if feature_path.exists() else None,
            "resultHash": file_hash(result_path) if result_path.exists() else None,
            "over25Hash": file_hash(over25_path) if over25_path.exists() else None,
            "bttsHash": file_hash(btts_path) if btts_path.exists() else None,
        }
    except Exception as e:
        return {
            "modelsLoaded": bundle is not None,
            "bundleError": bundle_error,
            "statusError": f"{type(e).__name__}: {e}",
        }

@app.post("/predictBatch", response_model=PredictBatchResponse)
def predict_batch(req: PredictBatchRequest):
    if bundle is None:
        raise HTTPException(status_code=503, detail=f"Models not loaded: {bundle_error}")

    feats = [it.features for it in req.items]
    X = build_matrix(feats, bundle.feature_names)

    pr = bundle.predict_result(X)  # (n,3)
    p_over = bundle.predict_binary(bundle.over25, X)
    p_btts = bundle.predict_binary(bundle.btts, X)

    preds = []
    for i, it in enumerate(req.items):
        pH, pD, pA = float(pr[i, 0]), float(pr[i, 1]), float(pr[i, 2])

        pick = "H"
        if pD > pH and pD >= pA:
            pick = "D"
        elif pA > pH and pA > pD:
            pick = "A"

        match_out = MatchResultOut(H=pH, D=pD, A=pA, pick=pick)

        over_y = float(p_over[i])
        over_out = BinaryOut(Y=over_y, N=float(1.0 - over_y), pick=("Y" if over_y >= 0.5 else "N"))

        btts_y = float(p_btts[i])
        btts_out = BinaryOut(Y=btts_y, N=float(1.0 - btts_y), pick=("Y" if btts_y >= 0.5 else "N"))

        preds.append(
            PredictionOut(
                fixtureId=it.fixtureId,
                matchResult=match_out,
                over25=over_out,
                btts=btts_out,
            )
        )

    return PredictBatchResponse(modelVersion=req.modelVersion, predictions=preds)
