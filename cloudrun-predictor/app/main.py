import os
import json
from pathlib import Path
import numpy as np
from fastapi import FastAPI, HTTPException
from app.schemas import (
    PredictBatchRequest,
    PredictBatchResponse,
    PredictionOut,
    MatchResultOut,
    BinaryOut,
    FeatureContributionOut,
)
from app.feature_flatten import build_matrix
from app.models import ModelBundle

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"


def _load_threshold_defaults() -> tuple[dict[str, float], dict[str, str]]:
    p = MODEL_DIR / "thresholds.json"
    defaults = {"over25": 0.59, "btts": 0.56}
    sources = {"over25": "hardcoded", "btts": "hardcoded"}
    if not p.exists():
        return defaults, sources

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        over = data.get("over25_threshold")
        btts = data.get("btts_threshold")
        if isinstance(over, (int, float)):
            defaults["over25"] = float(over)
            sources["over25"] = "thresholds.json"
        if isinstance(btts, (int, float)):
            defaults["btts"] = float(btts)
            sources["btts"] = "thresholds.json"
    except Exception as e:
        print(f"Invalid thresholds file at {p}: {type(e).__name__}: {e}")

    return defaults, sources


def _resolve_threshold(name: str, default: float, default_source: str) -> tuple[float, str]:
    raw = os.getenv(name)
    if raw is None:
        return default, default_source
    try:
        return float(raw), "env"
    except Exception:
        print(f"Invalid {name}={raw!r}; using default {default}")
        return default, default_source

THRESHOLD_DEFAULTS, THRESHOLD_SOURCES = _load_threshold_defaults()
OVER25_THRESHOLD, OVER25_SOURCE = _resolve_threshold(
    "OVER25_THRESHOLD",
    THRESHOLD_DEFAULTS["over25"],
    THRESHOLD_SOURCES["over25"],
)
BTTS_THRESHOLD, BTTS_SOURCE = _resolve_threshold(
    "BTTS_THRESHOLD",
    THRESHOLD_DEFAULTS["btts"],
    THRESHOLD_SOURCES["btts"],
)

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
        print(
            "Thresholds:",
            {
                "over25": {"value": OVER25_THRESHOLD, "source": OVER25_SOURCE},
                "btts": {"value": BTTS_THRESHOLD, "source": BTTS_SOURCE},
            },
        )
    except Exception as e:
        bundle = None
        bundle_error = f"{type(e).__name__}: {e}"
        print(f"Startup WARNING: models not loaded: {bundle_error}")


@app.get("/health")
def health():
    loaded = bundle is not None
    return {
        "ok": loaded,
        "modelsLoaded": loaded,
        "error": (None if loaded else bundle_error),
        "thresholds": {
            "over25": {"value": OVER25_THRESHOLD, "source": OVER25_SOURCE},
            "btts": {"value": BTTS_THRESHOLD, "source": BTTS_SOURCE},
        },
    }


@app.post("/predictBatch", response_model=PredictBatchResponse)
def predict_batch(req: PredictBatchRequest):
    if bundle is None:
        raise HTTPException(status_code=503, detail=f"Models not loaded: {bundle_error}")

    feats = [it.features for it in req.items]
    X = build_matrix(feats, bundle.feature_names)

    pr = bundle.predict_result(X)  # (n, 3) in order [H, D, A]
    p_over = bundle.predict_binary(bundle.over25, X)  # (n,)
    p_btts = bundle.predict_binary(bundle.btts, X)    # (n,)

    # quick telemetry
    if len(req.items) > 0:
        over_arr = np.asarray(p_over, dtype=float)
        btts_arr = np.asarray(p_btts, dtype=float)
        print(
            "Probs:",
            {
                "over25": {
                    "min": float(over_arr.min()),
                    "mean": float(over_arr.mean()),
                    "max": float(over_arr.max()),
                },
                "btts": {
                    "min": float(btts_arr.min()),
                    "mean": float(btts_arr.mean()),
                    "max": float(btts_arr.max()),
                },
            },
        )

    preds: list[PredictionOut] = []
    for i, it in enumerate(req.items):
        pH, pD, pA = float(pr[i, 0]), float(pr[i, 1]), float(pr[i, 2])

        # deterministic argmax
        pick = max({"H": pH, "D": pD, "A": pA}, key=lambda k: {"H": pH, "D": pD, "A": pA}[k])

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

        class_index = 0 if pick == "H" else 1 if pick == "D" else 2
        explain_rows, result_bias = bundle.explain_result_row(X[i], class_index, top_k=8)
        explain_out = [
            FeatureContributionOut(
                feature=str(row["feature"]),
                value=float(row["value"]),
                contribution=float(row["contribution"]),
            )
            for row in explain_rows
        ]

        preds.append(
            PredictionOut(
                fixtureId=it.fixtureId,
                matchResult=match_out,
                over25=over_out,
                btts=btts_out,
                resultExplain=explain_out,
                resultBias=result_bias,
            )
        )

    return PredictBatchResponse(modelVersion=req.modelVersion, predictions=preds)
