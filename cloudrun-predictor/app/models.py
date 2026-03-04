from pathlib import Path
import json
import numpy as np
import lightgbm as lgb

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"

class ModelBundle:
    def __init__(self) -> None:
        self.result = self._load_booster("lgbm_result.txt")    # multiclass (3)
        self.over25 = self._load_booster("lgbm_over25.txt")    # binary
        self.btts = self._load_booster("lgbm_btts.txt")        # binary
        self.feature_names = self._load_feature_names()
        self._validate_feature_alignment()

    def _load_feature_names(self) -> list[str]:
        p = MODEL_DIR / "feature_names.json"
        if not p.exists():
            raise FileNotFoundError(f"Missing feature names at {p}")
        names = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(names, list) or not all(isinstance(x, str) for x in names):
            raise ValueError("feature_names.json must be a JSON array of strings")
        return names

    def _load_booster(self, filename: str) -> lgb.Booster:
        p = MODEL_DIR / filename
        if not p.exists():
            raise FileNotFoundError(f"Missing model file at {p}")
        return lgb.Booster(model_file=str(p))

    def _validate_feature_alignment(self) -> None:
        result_names = list(self.result.feature_name())
        over_names = list(self.over25.feature_name())
        btts_names = list(self.btts.feature_name())

        if result_names != over_names or result_names != btts_names:
            raise ValueError("Model feature schemas differ across boosters")
        if self.feature_names != result_names:
            raise ValueError("feature_names.json does not match model feature schema")

    def predict_result(self, X: np.ndarray) -> np.ndarray:
        # returns shape (n, 3) probs
        if X.ndim != 2 or X.shape[1] != len(self.feature_names):
            raise ValueError(
                f"Invalid feature matrix shape {X.shape}; expected (*, {len(self.feature_names)})"
            )

        n_rows = X.shape[0]
        n_classes = int(self.result.params.get("num_class", 3))
        probs = self.result.predict(X)
        probs = np.asarray(probs, dtype=np.float64)
        if probs.ndim == 1:
            if probs.size != n_rows * n_classes:
                raise ValueError("Result model output shape mismatch for multiclass probabilities")
            probs = probs.reshape(n_rows, n_classes)

        probs = np.where(np.isfinite(probs), probs, 0.0)
        probs = np.clip(probs, 0.0, 1.0)
        row_sums = probs.sum(axis=1, keepdims=True)
        valid = np.isfinite(row_sums[:, 0]) & (row_sums[:, 0] > 0.0)
        if np.any(valid):
            probs[valid] = probs[valid] / row_sums[valid]
        if np.any(~valid):
            probs[~valid] = 1.0 / probs.shape[1]
        return probs

    def predict_binary(self, booster: lgb.Booster, X: np.ndarray) -> np.ndarray:
        # binary returns prob of class=1
        p1 = booster.predict(X)
        p1 = np.asarray(p1, dtype=np.float64).reshape(-1)
        p1 = np.where(np.isfinite(p1), p1, 0.5)
        p1 = np.clip(p1, 0.0, 1.0)
        return p1

    def explain_result_row(self, X_row: np.ndarray, class_index: int, top_k: int = 8) -> tuple[list[dict], float | None]:
        if X_row.ndim != 1 or X_row.shape[0] != len(self.feature_names):
            return [], None

        contrib = self.result.predict(X_row.reshape(1, -1), pred_contrib=True)
        contrib = np.asarray(contrib, dtype=np.float64)
        if contrib.ndim == 1:
            contrib = contrib.reshape(1, -1)

        n_features = len(self.feature_names)
        per_class_width = n_features + 1  # + bias
        expected_width = per_class_width * 3

        if contrib.shape[1] == expected_width:
            start = class_index * per_class_width
            values = contrib[0, start : start + per_class_width]
        elif contrib.shape[1] == per_class_width:
            values = contrib[0, :per_class_width]
        else:
            return [], None

        feature_contrib = values[:n_features]
        bias = values[n_features]

        ranked_idx = np.argsort(np.abs(feature_contrib))[::-1]
        top_idx = ranked_idx[: max(1, int(top_k))]

        out: list[dict] = []
        for idx in top_idx:
            out.append(
                {
                    "feature": self.feature_names[int(idx)],
                    "value": float(X_row[int(idx)]),
                    "contribution": float(feature_contrib[int(idx)]),
                }
            )

        return out, float(bias)
