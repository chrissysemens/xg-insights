from pathlib import Path
from typing import Tuple
import json
import numpy as np
import lightgbm as lgb

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"

class ModelBundle:
    def __init__(self) -> None:
        self.feature_names = self._load_feature_names()
        self.result = self._load_booster("lgbm_result.txt")    # multiclass (3)
        self.over25 = self._load_booster("lgbm_over25.txt")    # binary
        self.btts = self._load_booster("lgbm_btts.txt")        # binary

    def _load_feature_names(self) -> list[str]:
        p = MODEL_DIR / "feature_names.json"
        if not p.exists():
            raise FileNotFoundError(f"Missing feature names at {p}")
        return json.loads(p.read_text(encoding="utf-8"))

    def _load_booster(self, filename: str) -> lgb.Booster:
        p = MODEL_DIR / filename
        if not p.exists():
            raise FileNotFoundError(f"Missing model file at {p}")
        return lgb.Booster(model_file=str(p))

    def predict_result(self, X: np.ndarray) -> np.ndarray:
        # returns shape (n, 3) probs
        probs = self.result.predict(X)
        probs = np.asarray(probs, dtype=np.float64)
        if probs.ndim == 1:
            # safety: if model accidentally binary, shape fix
            raise ValueError("Result model returned 1D probs; expected 3-class.")
        return probs

    def predict_binary(self, booster: lgb.Booster, X: np.ndarray) -> np.ndarray:
        # binary returns prob of class=1
        p1 = booster.predict(X)
        p1 = np.asarray(p1, dtype=np.float64).reshape(-1)
        return p1
