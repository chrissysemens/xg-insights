# trainer/train_models.py
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Any, Dict, List

import lightgbm as lgb
import numpy as np
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import train_test_split

from build_dataset import build_dataset
from sportmonks import SMClient, fixtures_by_season, seasons_for_league

# Domestic leagues you listed (no cups)
LEAGUE_IDS = [
    8,    # Premier League
    9,    # Championship
    72,   # Eredivisie
    82,   # Bundesliga
    181,  # Austria Bundesliga
    208,  # Belgium Pro League
    244,  # Croatia 1. HNL
    271,  # Denmark Superliga
    301,  # Ligue 1
    384,  # Serie A
    387,  # Serie B
    444,  # Norway Eliteserien
    453,  # Poland Ekstraklasa
    462,  # Liga Portugal
    501,  # Scotland Premiership
    564,  # La Liga
    567,  # La Liga 2
    573,  # Sweden Allsvenskan
    591,  # Switzerland Super League
    600,  # Turkey Super Lig
]

MODEL_VERSION = os.environ.get("MODEL_VERSION", "epl-v2")


def pick_recent_seasons(seasons: List[Dict[str, Any]], n: int = 4) -> List[Dict[str, Any]]:
    """
    SportMonks season objects usually contain starting_at / ending_at.
    We sort by starting_at desc and take the most recent N seasons.
    """
    def key(s: Dict[str, Any]) -> str:
        return str(s.get("starting_at") or "")

    seasons_sorted = sorted(seasons, key=key, reverse=True)
    return seasons_sorted[:n]


def main():
    token = os.environ.get("SPORTMONKS_TOKEN")
    if not token:
        raise RuntimeError("Set SPORTMONKS_TOKEN env var (use the SAME token as your Firebase secret).")

    seasons_n = int(os.environ.get("SEASONS_N", "4"))
    client = SMClient(token=token)

    include = "state;participants;scores"

    raw: List[Dict[str, Any]] = []

    print(f"Training leagues: {LEAGUE_IDS}")
    for league_id in LEAGUE_IDS:
        print(f"\nFetching seasons for league_id={league_id} ...")
        seasons = seasons_for_league(client, league_id)
        if not seasons:
            print(f"  WARNING: No seasons returned for league_id={league_id}. Skipping.")
            continue

        picked = pick_recent_seasons(seasons, n=seasons_n)
        print("  Picked seasons:")
        for s in picked:
            print(
                f"   - id={s.get('id')} name={s.get('name')} "
                f"start={s.get('starting_at')} end={s.get('ending_at')}"
            )

        for s in picked:
            sid = s.get("id")
            if not sid:
                continue
            fixtures = fixtures_by_season(client, int(sid), include=include)
            print(f"  Season {sid}: fetched {len(fixtures)} fixtures")
            raw.extend(fixtures)

    print("\nFetched raw fixtures:", len(raw))
    if not raw:
        raise RuntimeError("Fetched 0 fixtures. Check token, include string, and season endpoints.")

    league_counts = Counter([f.get("league_id") for f in raw]).most_common(25)
    state_counts = Counter([(f.get("state") or {}).get("short_name") for f in raw]).most_common(15)
    print("league_id counts (top):", league_counts)
    print("state short_name counts (top):", state_counts)

    df = build_dataset(raw, league_ids=LEAGUE_IDS)
    print(f"\nTraining rows (after last-5 filter): {len(df)}")
    if df.empty:
        raise RuntimeError(
            "No training rows produced. Most common reasons:\n"
            "- score extraction didn't find CURRENT\n"
            "- finished state filter too strict\n"
            "- not enough prior matches (try last-3 temporarily)\n"
        )

    label_cols = ["label_result", "label_over25", "label_btts"]
    meta_cols = ["fixtureId", "kickoffTs"]
    feature_names = [c for c in df.columns if c not in label_cols + meta_cols]

    X = df[feature_names].values.astype(np.float32)
    y_result = df["label_result"].values.astype(int)
    y_over25 = df["label_over25"].values.astype(int)
    y_btts = df["label_btts"].values.astype(int)

    idx = np.arange(len(X))
    idx_train, idx_val = train_test_split(
        idx, test_size=0.2, random_state=42, stratify=y_result
    )

    X_train, X_val = X[idx_train], X[idx_val]
    yr_train, yr_val = y_result[idx_train], y_result[idx_val]
    yo_train, yo_val = y_over25[idx_train], y_over25[idx_val]
    yb_train, yb_val = y_btts[idx_train], y_btts[idx_val]  # ✅ fixed

    # ---- RESULT: multiclass (H/D/A) ----
    params_result = {
        "objective": "multiclass",
        "num_class": 3,
        "metric": "multi_logloss",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 40,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.9,
        "bagging_freq": 1,
        "seed": 42,
        "verbosity": -1,
    }

    print("\nTraining RESULT model (H/D/A)...")
    m_result = lgb.train(
        params_result,
        lgb.Dataset(X_train, label=yr_train, feature_name=feature_names),
        valid_sets=[lgb.Dataset(X_val, label=yr_val, feature_name=feature_names)],
        num_boost_round=2000,
        callbacks=[lgb.early_stopping(50)],
    )

    pr = m_result.predict(X_val)
    print("RESULT logloss:", float(log_loss(yr_val, pr)))
    print("RESULT acc:", float(accuracy_score(yr_val, np.argmax(pr, axis=1))))

    # ---- Binary models (with per-label scale_pos_weight) ----
    def train_binary(name: str, y_tr: np.ndarray, y_va: np.ndarray) -> lgb.Booster:
        pos_rate = float(np.mean(y_tr))
        # avoid divide-by-zero if something goes wrong upstream
        scale_pos_weight = (1.0 - pos_rate) / max(pos_rate, 1e-6)

        params_bin = {
            "objective": "binary",
            "metric": "binary_logloss",
            "learning_rate": 0.05,
            "num_leaves": 31,
            "min_data_in_leaf": 40,
            "feature_fraction": 0.9,
            "bagging_fraction": 0.9,
            "bagging_freq": 1,
            "seed": 42,
            "verbosity": -1,
            "scale_pos_weight": scale_pos_weight,  # ✅ key change
        }

        print(
            f"\nTraining {name} model "
            f"(pos_rate={pos_rate:.3f}, scale_pos_weight={scale_pos_weight:.2f})..."
        )

        m = lgb.train(
            params_bin,
            lgb.Dataset(X_train, label=y_tr, feature_name=feature_names),
            valid_sets=[lgb.Dataset(X_val, label=y_va, feature_name=feature_names)],
            num_boost_round=2000,
            callbacks=[lgb.early_stopping(50)],
        )

        pv = m.predict(X_val)
        print(f"{name} logloss:", float(log_loss(y_va, pv)))
        print(f"{name} val prob mean/min/max: {pv.mean():.3f} / {pv.min():.3f} / {pv.max():.3f}")
        return m

    m_over25 = train_binary("OVER25", yo_train, yo_val)
    m_btts = train_binary("BTTS", yb_train, yb_val)

    # ---- Export to Cloud Run model folder ----
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    model_dir = os.path.join(repo_root, "cloudrun-predictor", "model")
    os.makedirs(model_dir, exist_ok=True)

    with open(os.path.join(model_dir, "feature_names.json"), "w", encoding="utf-8") as f:
        json.dump(feature_names, f)

    # Save models (same filenames) + model_version info for debugging
    m_result.save_model(os.path.join(model_dir, "lgbm_result.txt"))
    m_over25.save_model(os.path.join(model_dir, "lgbm_over25.txt"))
    m_btts.save_model(os.path.join(model_dir, "lgbm_btts.txt"))

    with open(os.path.join(model_dir, "model_version.txt"), "w", encoding="utf-8") as f:
        f.write(MODEL_VERSION)

    print("\nExport complete → cloudrun-predictor/model/")
    print(f"MODEL_VERSION: {MODEL_VERSION}")
    print("Next: rebuild + redeploy Cloud Run so /status shows modelsLoaded=true")


if __name__ == "__main__":
    main()
