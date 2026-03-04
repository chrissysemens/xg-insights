from typing import Any, Dict, List
import numpy as np


def _derive_missing_features(src: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(src)

    if out.get("derived_pointsGapW5") is None:
        h = out.get("home_form5_pointsWAvg5")
        a = out.get("away_form5_pointsWAvg5")
        if h is not None and a is not None:
            out["derived_pointsGapW5"] = to_float(h) - to_float(a)

    if out.get("derived_goalForGapW5") is None:
        h = out.get("home_form5_goalsForWAvg5")
        a = out.get("away_form5_goalsForWAvg5")
        if h is not None and a is not None:
            out["derived_goalForGapW5"] = to_float(h) - to_float(a)

    if out.get("derived_goalsAgainstGapW5") is None:
        h = out.get("home_form5_goalsAgainstWAvg5")
        a = out.get("away_form5_goalsAgainstWAvg5")
        if h is not None and a is not None:
            out["derived_goalsAgainstGapW5"] = to_float(h) - to_float(a)

    return out

def to_float(v: Any) -> float:
    # LightGBM can handle NaNs
    if v is None:
        return float("nan")
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, np.generic):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v)
        except Exception:
            return float("nan")
    return float("nan")

def build_matrix(items: List[Dict[str, Any]], feature_names: List[str]) -> np.ndarray:
    X = np.empty((len(items), len(feature_names)), dtype=np.float64)

    league_feature_names = [name for name in feature_names if name.startswith("lg_")]

    for i, f in enumerate(items):
        ff = _derive_missing_features(f)

        # Training uses full one-hot league columns; missing keys should be 0.0, not NaN.
        for lg_name in league_feature_names:
            if lg_name not in ff or ff.get(lg_name) is None:
                ff[lg_name] = 0.0

        for j, name in enumerate(feature_names):
            X[i, j] = to_float(ff.get(name))
    return X
