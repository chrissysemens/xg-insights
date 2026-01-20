from typing import Any, Dict, List
import numpy as np

def to_float(v: Any) -> float:
    # LightGBM can handle NaNs
    if v is None:
        return float("nan")
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v)
        except Exception:
            return float("nan")
    return float("nan")

def build_matrix(items: List[Dict[str, Any]], feature_names: List[str]) -> np.ndarray:
    X = np.empty((len(items), len(feature_names)), dtype=np.float32)
    for i, f in enumerate(items):
        for j, name in enumerate(feature_names):
            X[i, j] = to_float(f.get(name))
    return X
