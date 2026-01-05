from typing import Any, Dict, List
import numpy as np

def flatten_dict(d: Dict[str, Any], prefix: str = "", out: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if out is None:
        out = {}
    for k, v in d.items():
        key = f"{prefix}{k}" if not prefix else f"{prefix}_{k}"
        if isinstance(v, dict):
            flatten_dict(v, key, out)
        else:
            out[key] = v
    return out

def to_float(v: Any) -> float:
    # LightGBM can handle NaNs
    if v is None:
        return float("nan")
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    # try parse numeric strings
    if isinstance(v, str):
        try:
            return float(v)
        except Exception:
            return float("nan")
    return float("nan")

import numpy as np
from typing import Any, Dict

def to_float(v: Any) -> float:
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

def build_matrix(items: list[Dict[str, Any]], feature_names: list[str]) -> np.ndarray:
    X = np.empty((len(items), len(feature_names)), dtype=np.float32)
    for i, f in enumerate(items):
        for j, name in enumerate(feature_names):
            X[i, j] = to_float(f.get(name))
    return X