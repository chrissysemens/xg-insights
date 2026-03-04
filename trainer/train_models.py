# trainer/train_models.py
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Any, Dict, List, Tuple

import lightgbm as lgb
import numpy as np
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, log_loss
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

MODEL_VERSION = os.environ.get("MODEL_VERSION", "epl-v3")

# Diagnostics toggles (optional)
RUN_BTTS_FORM_ONLY = os.environ.get("RUN_BTTS_FORM_ONLY", "0").strip() == "1"
RUN_OVER25_FORM_ONLY = os.environ.get("RUN_OVER25_FORM_ONLY", "1").strip() == "1"  # default ON

# "xG-present rows only" diagnostic
RUN_OVER25_XG_PRESENT_ONLY = os.environ.get("RUN_OVER25_XG_PRESENT_ONLY", "0").strip() == "1"

# Optional: loosen binary hyperparams when models look flat
LOOSEN_BINARY_PARAMS = os.environ.get("LOOSEN_BINARY_PARAMS", "0").strip() == "1"

# SportMonks fetch config
SEASONS_N_DEFAULT = 4


def hdr(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def pick_recent_seasons(seasons: List[Dict[str, Any]], n: int = 4) -> List[Dict[str, Any]]:
    """
    SportMonks season objects usually contain starting_at / ending_at.
    We sort by starting_at desc and take the most recent N seasons.
    """
    def key(s: Dict[str, Any]) -> str:
        return str(s.get("starting_at") or "")

    seasons_sorted = sorted(seasons, key=key, reverse=True)
    return seasons_sorted[:n]


def has_xg_fixture(f: Dict[str, Any]) -> bool:
    xg = f.get("xgfixture") or f.get("xgFixture") or f.get("xg_fixture")
    return isinstance(xg, list) and len(xg) >= 2


def split_feature_sets(
    df_columns: List[str],
    label_cols: List[str],
    meta_cols: List[str],
) -> Tuple[List[str], List[str], List[str]]:
    """
    Returns: (all_features, xg_features, non_xg_features)
    """
    feature_names = [c for c in df_columns if c not in set(label_cols + meta_cols)]

    def is_xgish(c: str) -> bool:
        cl = c.lower()
        # Keep this simple & robust: anything with xg or expectedGoals is "xG/tempo"
        if "expectedgoals" in cl:
            return True
        if "_xg" in cl:
            return True
        # Avoid matching league one-hot (lg_*)
        if "xg" in cl and not cl.startswith("lg_"):
            return True
        return False

    xg_features = [c for c in feature_names if is_xgish(c)]
    non_xg_features = [c for c in feature_names if c not in set(xg_features)]
    return feature_names, xg_features, non_xg_features


def print_ps_tips(script_name: str = "train_models.py") -> None:
    print("\nPowerShell tips:")
    print('  $env:RUN_BTTS_FORM_ONLY="1"; $env:RUN_OVER25_FORM_ONLY="1"; python ' + script_name)
    print('  $env:RUN_OVER25_XG_PRESENT_ONLY="1"; python ' + script_name)
    print('  $env:LOOSEN_BINARY_PARAMS="1"; python ' + script_name)
    print("  (Run from the folder that contains the script.)")


def calibrate_binary_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    name: str,
) -> Tuple[float, Dict[str, float]]:
    y_true = np.asarray(y_true, dtype=int).reshape(-1)
    y_prob = np.asarray(y_prob, dtype=float).reshape(-1)

    best_t = 0.5
    best_score = -1.0
    best_bal_acc = 0.0
    best_f1 = 0.0
    best_acc = 0.0

    for t in np.arange(0.30, 0.701, 0.01):
        y_hat = (y_prob >= t).astype(int)
        bal_acc = float(balanced_accuracy_score(y_true, y_hat))
        f1 = float(f1_score(y_true, y_hat, zero_division=0))
        acc = float(accuracy_score(y_true, y_hat))

        score = bal_acc * 0.7 + f1 * 0.3
        if score > best_score:
            best_score = score
            best_t = float(t)
            best_bal_acc = bal_acc
            best_f1 = f1
            best_acc = acc

    out = {
        "balanced_accuracy": best_bal_acc,
        "f1": best_f1,
        "accuracy": best_acc,
        "objective": best_score,
    }

    print(
        f"{name} calibrated threshold={best_t:.2f} "
        f"(bal_acc={best_bal_acc:.4f}, f1={best_f1:.4f}, acc={best_acc:.4f})"
    )

    return best_t, out


def main():
    token = os.environ.get("SPORTMONKS_TOKEN")
    if not token:
        raise RuntimeError("Set SPORTMONKS_TOKEN env var (use the SAME token as your Firebase secret).")

    seasons_n = int(os.environ.get("SEASONS_N", str(SEASONS_N_DEFAULT)))
    client = SMClient(token=token)

    # IMPORTANT: must match SportMonks include naming
    include = "state;participants;scores;xgfixture"

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

    hdr("RAW FIXTURE SUMMARY")
    print("Fetched raw fixtures:", len(raw))
    if not raw:
        raise RuntimeError("Fetched 0 fixtures. Check token, include string, and season endpoints.")

    xg_count = sum(1 for f in raw if has_xg_fixture(f))
    print("Fixtures with xG:", xg_count, "/", len(raw), f"({(xg_count / len(raw)):.1%})")

    league_counts = Counter([f.get("league_id") for f in raw]).most_common(25)
    state_counts = Counter([(f.get("state") or {}).get("short_name") for f in raw]).most_common(15)
    print("league_id counts (top):", league_counts)
    print("state short_name counts (top):", state_counts)

    hdr("BUILD DATASET")
    df = build_dataset(raw, league_ids=LEAGUE_IDS)
    print(f"Training rows (after last-5 filter): {len(df)}")
    if df.empty:
        raise RuntimeError(
            "No training rows produced. Most common reasons:\n"
            "- score extraction didn't find CURRENT\n"
            "- finished state filter too strict\n"
            "- not enough prior matches (try last-3 temporarily)\n"
        )

    label_cols = ["label_result", "label_over25", "label_btts"]
    meta_cols = ["fixtureId", "kickoffTs"]

    feature_names, xg_features, non_xg_features = split_feature_sets(
        list(df.columns), label_cols=label_cols, meta_cols=meta_cols
    )

    print(f"Features: {len(feature_names)}")
    print(f"xG/tempo features: {len(xg_features)}")
    print(f"Non-xG features: {len(non_xg_features)}")

    # Label arrays
    hdr("LABEL DISTRIBUTIONS")
    y_result = df["label_result"].values.astype(int)
    y_over25 = df["label_over25"].values.astype(int)
    y_btts = df["label_btts"].values.astype(int)

    print("RESULT label counts (H=0, D=1, A=2):", Counter(y_result))
    print("OVER25 pos_rate:", float(np.mean(y_over25)))
    print("BTTS  pos_rate:", float(np.mean(y_btts)))

    # Split indices (stratify by result)
    hdr("SPLIT")
    idx = np.arange(len(df))
    idx_train, idx_val = train_test_split(
        idx, test_size=0.2, random_state=42, stratify=y_result
    )
    print(f"Train rows: {len(idx_train)} | Val rows: {len(idx_val)}")
    print("Train RESULT counts:", Counter(y_result[idx_train]))
    print("Val   RESULT counts:", Counter(y_result[idx_val]))
    print("Train OVER25 pos_rate:", float(np.mean(y_over25[idx_train])),
          "| Val:", float(np.mean(y_over25[idx_val])))
    print("Train BTTS  pos_rate:", float(np.mean(y_btts[idx_train])),
          "| Val:", float(np.mean(y_btts[idx_val])))

    # Global X (all features) used for RESULT + baseline binaries
    X_all = df[feature_names].values.astype(np.float32)
    X_train_all, X_val_all = X_all[idx_train], X_all[idx_val]

    yr_train, yr_val = y_result[idx_train], y_result[idx_val]
    yo_train, yo_val = y_over25[idx_train], y_over25[idx_val]
    yb_train, yb_val = y_btts[idx_train], y_btts[idx_val]

    # Feature health
    hdr("FEATURE HEALTH (NaN + core sanity)")
    nan_rates = df[feature_names].isna().mean().sort_values(ascending=False)
    print("Top NaN-rate features:")
    print(nan_rates.head(25))

    if xg_features:
        xg_nan_rates = df[xg_features].isna().mean().sort_values(ascending=False)
        print("\nTop NaN-rate among xG/tempo features:")
        print(xg_nan_rates.head(25))
        print("\nMean NaN rate (xG/tempo):", float(df[xg_features].isna().mean().mean()))
        print("Mean NaN rate (non-xG):", float(df[non_xg_features].isna().mean().mean()) if non_xg_features else 0.0)

    core = [
        "home_form5_goalsForAvg5",
        "home_form5_goalsAgainstAvg5",
        "away_form5_goalsForAvg5",
        "away_form5_goalsAgainstAvg5",
        "home_form5_csRate5",
        "home_form5_ftsRate5",
        "away_form5_csRate5",
        "away_form5_ftsRate5",
    ]
    existing_core = [c for c in core if c in df.columns]
    if existing_core:
        print("\nCore feature NaN rates:")
        print(df[existing_core].isna().mean())
        print("\nCore feature stddev (should NOT be ~0):")
        print(df[existing_core].std(numeric_only=True))

    # ---- RESULT: multiclass (H/D/A) ----
    hdr("TRAIN RESULT (H/D/A)")
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

    print("Training until validation scores don't improve for 50 rounds")
    m_result = lgb.train(
        params_result,
        lgb.Dataset(X_train_all, label=yr_train, feature_name=feature_names),
        valid_sets=[lgb.Dataset(X_val_all, label=yr_val, feature_name=feature_names)],
        num_boost_round=2000,
        callbacks=[lgb.early_stopping(50)],
    )

    pr = m_result.predict(X_val_all)
    result_logloss = float(log_loss(yr_val, pr))
    result_acc = float(accuracy_score(yr_val, np.argmax(pr, axis=1)))
    print("RESULT logloss:", result_logloss)
    print("RESULT acc:", result_acc)
    print("RESULT best_iteration:", int(m_result.best_iteration or 0))

    # ---- Binary models ----
    hdr("TRAIN BINARY (OVER25 / BTTS)")

    def train_binary_custom(
        name: str,
        X_tr: np.ndarray,
        X_va: np.ndarray,
        y_tr: np.ndarray,
        y_va: np.ndarray,
        feat_names: List[str],
    ) -> lgb.Booster:
        pos_rate = float(np.mean(y_tr))
        scale_pos_weight = (1.0 - pos_rate) / max(pos_rate, 1e-6)

        # If binary looks weak/flat, loosen (optional)
        if LOOSEN_BINARY_PARAMS:
            num_leaves = 63
            min_data_in_leaf = 20
            feature_fraction = 1.0
            learning_rate = 0.05
        else:
            num_leaves = 31
            min_data_in_leaf = 40
            feature_fraction = 0.9
            learning_rate = 0.05

        params_bin = {
            "objective": "binary",
            "metric": "binary_logloss",
            "learning_rate": learning_rate,
            "num_leaves": num_leaves,
            "min_data_in_leaf": min_data_in_leaf,
            "feature_fraction": feature_fraction,
            "bagging_fraction": 0.9,
            "bagging_freq": 1,
            "seed": 42,
            "verbosity": -1,
            "scale_pos_weight": scale_pos_weight,
        }

        print(
            f"\n{name}: pos_rate(train)={pos_rate:.3f} scale_pos_weight={scale_pos_weight:.2f} "
            f"features={len(feat_names)} (LOOSEN_BINARY_PARAMS={LOOSEN_BINARY_PARAMS})"
        )
        print("Training until validation scores don't improve for 50 rounds")

        m = lgb.train(
            params_bin,
            lgb.Dataset(X_tr, label=y_tr, feature_name=feat_names),
            valid_sets=[lgb.Dataset(X_va, label=y_va, feature_name=feat_names)],
            num_boost_round=2000,
            callbacks=[lgb.early_stopping(50)],
        )

        pv = m.predict(X_va)
        ll = float(log_loss(y_va, pv))
        pmin = float(np.min(pv))
        pmax = float(np.max(pv))
        pmean = float(np.mean(pv))
        prob_range = pmax - pmin

        print(f"{name} logloss:", ll)
        print(f"{name} val prob mean/min/max: {pmean:.3f} / {pmin:.3f} / {pmax:.3f}")
        print(f"{name} best_iteration:", int(m.best_iteration or 0))

        # Helpful warning for "flat" models
        if (m.best_iteration or 0) <= 3 or prob_range < 0.08:
            print(
                f"WARNING: {name} looks weak/flat "
                f"(best_iteration={int(m.best_iteration or 0)}, prob_range={prob_range:.3f}). "
                "Consider form-only, xG-present filtering, or loosening params."
            )

        return m

    # Baseline binaries (FULL features)
    m_over25 = train_binary_custom("OVER25", X_train_all, X_val_all, yo_train, yo_val, feature_names)
    m_btts = train_binary_custom("BTTS", X_train_all, X_val_all, yb_train, yb_val, feature_names)

    hdr("CALIBRATE BINARY THRESHOLDS (VALIDATION)")
    over25_val_prob = m_over25.predict(X_val_all)
    btts_val_prob = m_btts.predict(X_val_all)

    over25_threshold, over25_metrics = calibrate_binary_threshold(
        yo_val, over25_val_prob, "OVER25"
    )
    btts_threshold, btts_metrics = calibrate_binary_threshold(
        yb_val, btts_val_prob, "BTTS"
    )

    # Diagnostics: BTTS form-only
    if RUN_BTTS_FORM_ONLY:
        hdr("DIAGNOSTIC: BTTS FORM-ONLY (NO xG)")
        btts_form_cols = non_xg_features
        X_train_f = df.loc[idx_train, btts_form_cols].values.astype(np.float32)
        X_val_f = df.loc[idx_val, btts_form_cols].values.astype(np.float32)
        print(f"BTTS form-only features: {len(btts_form_cols)} (removed {len(xg_features)} xG/tempo features)")
        _ = train_binary_custom("BTTS_FORM_ONLY", X_train_f, X_val_f, yb_train, yb_val, btts_form_cols)

    # Diagnostics: OVER25 form-only
    if RUN_OVER25_FORM_ONLY:
        hdr("DIAGNOSTIC: OVER25 FORM-ONLY (NO xG)")
        over25_form_cols = non_xg_features
        X_train_f = df.loc[idx_train, over25_form_cols].values.astype(np.float32)
        X_val_f = df.loc[idx_val, over25_form_cols].values.astype(np.float32)
        print(f"OVER25 form-only features: {len(over25_form_cols)} (removed {len(xg_features)} xG/tempo features)")
        _ = train_binary_custom("OVER25_FORM_ONLY", X_train_f, X_val_f, yo_train, yo_val, over25_form_cols)

    # Diagnostics: OVER25 on xG-present rows only (optional, important)
    if RUN_OVER25_XG_PRESENT_ONLY and xg_features:
        hdr("DIAGNOSTIC: OVER25 xG-PRESENT ONLY (rows with xG sample)")

        # Prefer these if present (your build_dataset.py makes them)
        sample_cols = [c for c in df.columns if c in ("home_xg5_sampleSize", "away_xg5_sampleSize")]

        if len(sample_cols) == 2:
            mask = (df["home_xg5_sampleSize"].fillna(0) > 0) & (df["away_xg5_sampleSize"].fillna(0) > 0)
        else:
            # fallback to derived tempo not-na
            fallback_col = "derived_expectedGoalsTotal5"
            if fallback_col in df.columns:
                mask = df[fallback_col].notna()
            else:
                mask = pd.Series([False] * len(df))

        sub_idx = np.where(mask.values)[0]
        if len(sub_idx) < 1000:
            print(f"WARNING: xG-present subset is small ({len(sub_idx)} rows). Skipping.")
        else:
            sub_train = np.intersect1d(idx_train, sub_idx)
            sub_val = np.intersect1d(idx_val, sub_idx)
            print(f"xG-present Train rows: {len(sub_train)} | Val rows: {len(sub_val)}")

            X_tr = df.loc[sub_train, feature_names].values.astype(np.float32)
            X_va = df.loc[sub_val, feature_names].values.astype(np.float32)
            y_tr = y_over25[sub_train]
            y_va = y_over25[sub_val]

            _ = train_binary_custom("OVER25_XG_PRESENT", X_tr, X_va, y_tr, y_va, feature_names)

    # ---- Export to Cloud Run model folder ----
    hdr("EXPORT MODELS")
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    model_dir = os.path.join(repo_root, "cloudrun-predictor", "model")
    os.makedirs(model_dir, exist_ok=True)

    with open(os.path.join(model_dir, "feature_names.json"), "w", encoding="utf-8") as f:
        json.dump(feature_names, f)

    thresholds_payload = {
        "modelVersion": MODEL_VERSION,
        "over25_threshold": over25_threshold,
        "btts_threshold": btts_threshold,
        "calibration": {
            "over25": over25_metrics,
            "btts": btts_metrics,
        },
    }
    with open(os.path.join(model_dir, "thresholds.json"), "w", encoding="utf-8") as f:
        json.dump(thresholds_payload, f, indent=2)

    # Save models (same filenames) + model_version info for debugging
    m_result.save_model(os.path.join(model_dir, "lgbm_result.txt"))
    m_over25.save_model(os.path.join(model_dir, "lgbm_over25.txt"))
    m_btts.save_model(os.path.join(model_dir, "lgbm_btts.txt"))

    with open(os.path.join(model_dir, "model_version.txt"), "w", encoding="utf-8") as f:
        f.write(MODEL_VERSION)

    print("\nExport complete → cloudrun-predictor/model/")
    print(f"MODEL_VERSION: {MODEL_VERSION}")
    print(f"Calibrated OVER25 threshold: {over25_threshold:.2f}")
    print(f"Calibrated BTTS threshold:   {btts_threshold:.2f}")
    print("Next: rebuild + redeploy Cloud Run so /status shows modelsLoaded=true")

    print_ps_tips("train_models.py")


if __name__ == "__main__":
    main()
