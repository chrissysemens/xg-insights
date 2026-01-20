# build_dataset.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np


def weighted_avg(values: List[float], weights: List[float]) -> float:
    # values expected newest -> oldest
    if not values:
        return np.nan
    w = weights[: len(values)]
    denom = float(np.sum(w))
    if denom <= 0:
        return np.nan
    v = np.asarray(values, dtype=float)
    ww = np.asarray(w, dtype=float)
    return float(np.sum(v * ww) / denom)


W5 = [1.0, 0.85, 0.7, 0.55, 0.4]
W10 = [1.0, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26]


def get_xg_list(fx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    SportMonks include may appear as 'xgfixture' or 'xgFixture' depending on client/casing.
    """
    xg = fx.get("xgfixture")
    if isinstance(xg, list):
        return xg
    xg2 = fx.get("xgFixture")
    if isinstance(xg2, list):
        return xg2
    return []


def extract_final_score(
    scores: List[Dict[str, Any]],
    home_id: int,
    away_id: int,
) -> Optional[Tuple[int, int]]:
    if not scores:
        return None

    home_goals = None
    away_goals = None

    for s in scores:
        if s.get("description") != "CURRENT":
            continue
        pid = s.get("participant_id")
        goals = ((s.get("score") or {}).get("goals"))
        if pid == home_id:
            home_goals = goals
        elif pid == away_id:
            away_goals = goals

    if home_goals is None or away_goals is None:
        return None

    return int(home_goals), int(away_goals)


def extract_home_away_ids(
    participants: List[Dict[str, Any]],
) -> Optional[Tuple[int, int]]:
    if not participants:
        return None

    home = None
    away = None
    for p in participants:
        meta = p.get("meta") or {}
        loc = meta.get("location")
        if loc == "home":
            home = p.get("id")
        elif loc == "away":
            away = p.get("id")

    if not home or not away:
        return None

    return int(home), int(away)


def points_for_result(gf: int, ga: int) -> int:
    if gf > ga:
        return 3
    if gf == ga:
        return 1
    return 0


def build_team_form(
    last_n_matches: List[Dict[str, Any]],
    team_id: int,
    n_label: int,
) -> Dict[str, float]:
    n = len(last_n_matches)
    if n == 0:
        return {
            "matches": 0,
            f"pointsAvg{n_label}": np.nan,
            f"goalsForAvg{n_label}": np.nan,
            f"goalsAgainstAvg{n_label}": np.nan,
            f"winRate{n_label}": np.nan,
            f"drawRate{n_label}": np.nan,
            f"lossRate{n_label}": np.nan,
            f"csRate{n_label}": np.nan,
            f"ftsRate{n_label}": np.nan,
            f"pointsWAvg{n_label}": np.nan,
            f"goalsForWAvg{n_label}": np.nan,
            f"goalsAgainstWAvg{n_label}": np.nan,
        }

    wins = draws = losses = 0
    clean_sheets = 0
    failed_to_score = 0

    goals_for: List[int] = []
    goals_against: List[int] = []
    points: List[int] = []

    for m in last_n_matches:  # newest -> oldest
        is_home = m["homeTeamId"] == team_id
        gf = int(m["homeGoals"] if is_home else m["awayGoals"])
        ga = int(m["awayGoals"] if is_home else m["homeGoals"])

        goals_for.append(gf)
        goals_against.append(ga)

        if ga == 0:
            clean_sheets += 1
        if gf == 0:
            failed_to_score += 1

        p = points_for_result(gf, ga)
        points.append(p)

        if p == 3:
            wins += 1
        elif p == 1:
            draws += 1
        else:
            losses += 1

    denom = float(n)
    weights = W5 if n_label == 5 else W10

    return {
        "matches": n,
        f"pointsAvg{n_label}": float(np.mean(points)) if points else np.nan,
        f"goalsForAvg{n_label}": float(np.mean(goals_for)) if goals_for else np.nan,
        f"goalsAgainstAvg{n_label}": float(np.mean(goals_against)) if goals_against else np.nan,
        f"winRate{n_label}": wins / denom,
        f"drawRate{n_label}": draws / denom,
        f"lossRate{n_label}": losses / denom,
        f"csRate{n_label}": clean_sheets / denom,
        f"ftsRate{n_label}": failed_to_score / denom,
        f"pointsWAvg{n_label}": weighted_avg([float(x) for x in points], weights),
        f"goalsForWAvg{n_label}": weighted_avg([float(x) for x in goals_for], weights),
        f"goalsAgainstWAvg{n_label}": weighted_avg([float(x) for x in goals_against], weights),
    }


def extract_xg_pair(fx: Dict[str, Any], team_id: int) -> Optional[Tuple[float, float]]:
    """
    Returns (team_xg, opp_xg) for this fixture if xG is present.
    SportMonks: xg list is 2 entries (one per team), but casing may vary.
    """
    xg = get_xg_list(fx)
    if len(xg) < 2:
        return None

    team_row = None
    opp_row = None

    for row in xg:
        pid = row.get("participant_id")
        if pid == team_id:
            team_row = row
        elif pid is not None:
            opp_row = row

    if not isinstance(team_row, dict) or not isinstance(opp_row, dict):
        return None

    team_val = (team_row.get("data") or {}).get("value")
    opp_val = (opp_row.get("data") or {}).get("value")

    if isinstance(team_val, (int, float)) and isinstance(opp_val, (int, float)):
        return float(team_val), float(opp_val)

    return None


def build_team_xg(
    last_n_fixtures: List[Dict[str, Any]],
    team_id: int,
    n_label: int,
) -> Dict[str, float]:
    """
    last_n_fixtures: newest -> oldest fixtures that may contain xG
    We keep only fixtures with xG and then compute avg + weighted avg.
    """
    xg_for: List[float] = []
    xg_against: List[float] = []

    for fx in last_n_fixtures:
        pair = extract_xg_pair(fx, team_id)
        if not pair:
            continue
        xf, xa = pair
        xg_for.append(xf)
        xg_against.append(xa)

    weights = W5 if n_label == 5 else W10

    xg_for_avg = float(np.mean(xg_for)) if xg_for else np.nan
    xg_against_avg = float(np.mean(xg_against)) if xg_against else np.nan
    xg_diff_avg = (xg_for_avg - xg_against_avg) if xg_for else np.nan

    xg_for_w = weighted_avg(xg_for, weights)
    xg_against_w = weighted_avg(xg_against, weights)
    xg_diff_w = (
        (xg_for_w - xg_against_w)
        if not np.isnan(xg_for_w) and not np.isnan(xg_against_w)
        else np.nan
    )

    return {
        "sampleSize": float(len(xg_for)),
        f"xgForAvg{n_label}": xg_for_avg,
        f"xgAgainstAvg{n_label}": xg_against_avg,
        f"xgDiffAvg{n_label}": xg_diff_avg,
        f"xgForWAvg{n_label}": xg_for_w,
        f"xgAgainstWAvg{n_label}": xg_against_w,
        f"xgDiffWAvg{n_label}": xg_diff_w,
    }


def build_dataset(fixtures_raw: List[Dict[str, Any]], league_ids: List[int]) -> pd.DataFrame:
    league_set = set(int(x) for x in league_ids)

    rows: List[Dict[str, Any]] = []
    fx_by_id: Dict[int, Dict[str, Any]] = {}

    for f in fixtures_raw:
        lid = int(f.get("league_id") or 0)
        if lid not in league_set:
            continue

        state = f.get("state") or {}
        if state.get("short_name") != "FT":
            continue

        participants = f.get("participants") or []
        ha = extract_home_away_ids(participants)
        if not ha:
            continue
        home_id, away_id = ha

        scores = f.get("scores") or []
        ft = extract_final_score(scores, home_id, away_id)
        if not ft:
            continue
        hg, ag = ft

        kickoff_ts = int(f.get("starting_at_timestamp") or 0)
        if kickoff_ts <= 0:
            continue

        fixture_id = int(f["id"])
        fx_by_id[fixture_id] = f  # keep raw fixture to read xG later

        rows.append(
            {
                "fixtureId": fixture_id,
                "kickoffTs": kickoff_ts,
                "leagueId": lid,
                "homeTeamId": home_id,
                "awayTeamId": away_id,
                "homeGoals": int(hg),
                "awayGoals": int(ag),
            }
        )

    base = pd.DataFrame(rows)
    if base.empty:
        return base

    base = base.sort_values("kickoffTs").reset_index(drop=True)

    matches_by_team: Dict[int, List[Dict[str, Any]]] = {}
    for r in base.itertuples(index=False):
        m = {
            "fixtureId": int(r.fixtureId),
            "kickoffTs": int(r.kickoffTs),
            "leagueId": int(r.leagueId),
            "homeTeamId": int(r.homeTeamId),
            "awayTeamId": int(r.awayTeamId),
            "homeGoals": int(r.homeGoals),
            "awayGoals": int(r.awayGoals),
        }
        matches_by_team.setdefault(m["homeTeamId"], []).append(m)
        matches_by_team.setdefault(m["awayTeamId"], []).append(m)

    for tid in matches_by_team:
        matches_by_team[tid].sort(key=lambda x: x["kickoffTs"])  # oldest -> newest

    league_ids_sorted = sorted(league_set)

    out_rows: List[Dict[str, Any]] = []
    for r in base.itertuples(index=False):
        fixture_id = int(r.fixtureId)
        kickoff_ts = int(r.kickoffTs)
        league_id = int(r.leagueId)
        home_id = int(r.homeTeamId)
        away_id = int(r.awayTeamId)

        home_hist = [m for m in matches_by_team.get(home_id, []) if m["kickoffTs"] < kickoff_ts]
        away_hist = [m for m in matches_by_team.get(away_id, []) if m["kickoffTs"] < kickoff_ts]

        # newest -> oldest for weighting
        home_last10 = list(reversed(home_hist[-10:]))
        away_last10 = list(reversed(away_hist[-10:]))

        home_last5 = home_last10[:5]
        away_last5 = away_last10[:5]

        if len(home_last5) < 5 or len(away_last5) < 5:
            continue

        home_form5 = build_team_form(home_last5, home_id, n_label=5)
        away_form5 = build_team_form(away_last5, away_id, n_label=5)
        home_form10 = build_team_form(home_last10, home_id, n_label=10)
        away_form10 = build_team_form(away_last10, away_id, n_label=10)

        # xG needs raw fixtures for those match ids
        home_last5_fx = [fx_by_id.get(int(m["fixtureId"])) for m in home_last5]
        away_last5_fx = [fx_by_id.get(int(m["fixtureId"])) for m in away_last5]
        home_last10_fx = [fx_by_id.get(int(m["fixtureId"])) for m in home_last10]
        away_last10_fx = [fx_by_id.get(int(m["fixtureId"])) for m in away_last10]

        home_last5_fx = [x for x in home_last5_fx if isinstance(x, dict)]
        away_last5_fx = [x for x in away_last5_fx if isinstance(x, dict)]
        home_last10_fx = [x for x in home_last10_fx if isinstance(x, dict)]
        away_last10_fx = [x for x in away_last10_fx if isinstance(x, dict)]

        home_xg5 = build_team_xg(home_last5_fx, home_id, n_label=5)
        away_xg5 = build_team_xg(away_last5_fx, away_id, n_label=5)
        home_xg10 = build_team_xg(home_last10_fx, home_id, n_label=10)
        away_xg10 = build_team_xg(away_last10_fx, away_id, n_label=10)

        hg = int(r.homeGoals)
        ag = int(r.awayGoals)

        if hg > ag:
            label_result = 0
        elif hg == ag:
            label_result = 1
        else:
            label_result = 2

        label_over25 = 1 if (hg + ag) >= 3 else 0
        label_btts = 1 if (hg > 0 and ag > 0) else 0

        # derived tempo/script (match your TS naming)
        derived_expectedGoalsTotal5 = (
            float(home_xg5["xgForAvg5"] + away_xg5["xgForAvg5"])
            if not np.isnan(home_xg5["xgForAvg5"]) and not np.isnan(away_xg5["xgForAvg5"])
            else np.nan
        )
        derived_expectedGoalsAsym5 = (
            float(abs(home_xg5["xgDiffAvg5"] - away_xg5["xgDiffAvg5"]))
            if not np.isnan(home_xg5["xgDiffAvg5"]) and not np.isnan(away_xg5["xgDiffAvg5"])
            else np.nan
        )

        derived_expectedGoalsTotal10 = (
            float(home_xg10["xgForAvg10"] + away_xg10["xgForAvg10"])
            if not np.isnan(home_xg10["xgForAvg10"]) and not np.isnan(away_xg10["xgForAvg10"])
            else np.nan
        )
        derived_expectedGoalsAsym10 = (
            float(abs(home_xg10["xgDiffAvg10"] - away_xg10["xgDiffAvg10"]))
            if not np.isnan(home_xg10["xgDiffAvg10"]) and not np.isnan(away_xg10["xgDiffAvg10"])
            else np.nan
        )

        derived_expectedGoalsTotalW5 = (
            float(home_xg5["xgForWAvg5"] + away_xg5["xgForWAvg5"])
            if not np.isnan(home_xg5["xgForWAvg5"]) and not np.isnan(away_xg5["xgForWAvg5"])
            else np.nan
        )
        derived_expectedGoalsAsymW5 = (
            float(abs(home_xg5["xgDiffWAvg5"] - away_xg5["xgDiffWAvg5"]))
            if not np.isnan(home_xg5["xgDiffWAvg5"]) and not np.isnan(away_xg5["xgDiffWAvg5"])
            else np.nan
        )

        derived_expectedGoalsTotalW10 = (
            float(home_xg10["xgForWAvg10"] + away_xg10["xgForWAvg10"])
            if not np.isnan(home_xg10["xgForWAvg10"]) and not np.isnan(away_xg10["xgForWAvg10"])
            else np.nan
        )
        derived_expectedGoalsAsymW10 = (
            float(abs(home_xg10["xgDiffWAvg10"] - away_xg10["xgDiffWAvg10"]))
            if not np.isnan(home_xg10["xgDiffWAvg10"]) and not np.isnan(away_xg10["xgDiffWAvg10"])
            else np.nan
        )

        # derived gaps (keep your older gaps too)
        derived_pointsGap5 = float(home_form5["pointsAvg5"] - away_form5["pointsAvg5"])
        derived_goalForGap5 = float(home_form5["goalsForAvg5"] - away_form5["goalsForAvg5"])
        derived_goalsAgainstGap5 = float(home_form5["goalsAgainstAvg5"] - away_form5["goalsAgainstAvg5"])

        derived_pointsGapW5 = float(home_form5["pointsWAvg5"] - away_form5["pointsWAvg5"])
        derived_goalForGapW5 = float(home_form5["goalsForWAvg5"] - away_form5["goalsForWAvg5"])
        derived_goalsAgainstGapW5 = float(home_form5["goalsAgainstWAvg5"] - away_form5["goalsAgainstWAvg5"])

        feat: Dict[str, Any] = {
            # form5 unweighted
            "home_form5_matches": float(home_form5["matches"]),
            "home_form5_pointsAvg5": float(home_form5["pointsAvg5"]),
            "home_form5_goalsForAvg5": float(home_form5["goalsForAvg5"]),
            "home_form5_goalsAgainstAvg5": float(home_form5["goalsAgainstAvg5"]),
            "home_form5_winRate5": float(home_form5["winRate5"]),
            "home_form5_drawRate5": float(home_form5["drawRate5"]),
            "home_form5_lossRate5": float(home_form5["lossRate5"]),
            "home_form5_csRate5": float(home_form5["csRate5"]),
            "home_form5_ftsRate5": float(home_form5["ftsRate5"]),
            "away_form5_matches": float(away_form5["matches"]),
            "away_form5_pointsAvg5": float(away_form5["pointsAvg5"]),
            "away_form5_goalsForAvg5": float(away_form5["goalsForAvg5"]),
            "away_form5_goalsAgainstAvg5": float(away_form5["goalsAgainstAvg5"]),
            "away_form5_winRate5": float(away_form5["winRate5"]),
            "away_form5_drawRate5": float(away_form5["drawRate5"]),
            "away_form5_lossRate5": float(away_form5["lossRate5"]),
            "away_form5_csRate5": float(away_form5["csRate5"]),
            "away_form5_ftsRate5": float(away_form5["ftsRate5"]),

            # form5 weighted
            "home_form5_pointsWAvg5": float(home_form5["pointsWAvg5"]),
            "home_form5_goalsForWAvg5": float(home_form5["goalsForWAvg5"]),
            "home_form5_goalsAgainstWAvg5": float(home_form5["goalsAgainstWAvg5"]),
            "away_form5_pointsWAvg5": float(away_form5["pointsWAvg5"]),
            "away_form5_goalsForWAvg5": float(away_form5["goalsForWAvg5"]),
            "away_form5_goalsAgainstWAvg5": float(away_form5["goalsAgainstWAvg5"]),

            # form10 unweighted
            "home_form10_matches": float(home_form10["matches"]),
            "home_form10_pointsAvg10": float(home_form10["pointsAvg10"]),
            "home_form10_goalsForAvg10": float(home_form10["goalsForAvg10"]),
            "home_form10_goalsAgainstAvg10": float(home_form10["goalsAgainstAvg10"]),
            "home_form10_winRate10": float(home_form10["winRate10"]),
            "home_form10_drawRate10": float(home_form10["drawRate10"]),
            "home_form10_lossRate10": float(home_form10["lossRate10"]),
            "home_form10_csRate10": float(home_form10["csRate10"]),
            "home_form10_ftsRate10": float(home_form10["ftsRate10"]),
            "away_form10_matches": float(away_form10["matches"]),
            "away_form10_pointsAvg10": float(away_form10["pointsAvg10"]),
            "away_form10_goalsForAvg10": float(away_form10["goalsForAvg10"]),
            "away_form10_goalsAgainstAvg10": float(away_form10["goalsAgainstAvg10"]),
            "away_form10_winRate10": float(away_form10["winRate10"]),
            "away_form10_drawRate10": float(away_form10["drawRate10"]),
            "away_form10_lossRate10": float(away_form10["lossRate10"]),
            "away_form10_csRate10": float(away_form10["csRate10"]),
            "away_form10_ftsRate10": float(away_form10["ftsRate10"]),

            # form10 weighted
            "home_form10_pointsWAvg10": float(home_form10["pointsWAvg10"]),
            "home_form10_goalsForWAvg10": float(home_form10["goalsForWAvg10"]),
            "home_form10_goalsAgainstWAvg10": float(home_form10["goalsAgainstWAvg10"]),
            "away_form10_pointsWAvg10": float(away_form10["pointsWAvg10"]),
            "away_form10_goalsForWAvg10": float(away_form10["goalsForWAvg10"]),
            "away_form10_goalsAgainstWAvg10": float(away_form10["goalsAgainstWAvg10"]),

            # xg5 unweighted + weighted
            "home_xg5_sampleSize": float(home_xg5["sampleSize"]),
            "home_xg5_xgForAvg5": float(home_xg5["xgForAvg5"]),
            "home_xg5_xgAgainstAvg5": float(home_xg5["xgAgainstAvg5"]),
            "home_xg5_xgDiffAvg5": float(home_xg5["xgDiffAvg5"]),
            "home_xg5_xgForWAvg5": float(home_xg5["xgForWAvg5"]),
            "home_xg5_xgAgainstWAvg5": float(home_xg5["xgAgainstWAvg5"]),
            "home_xg5_xgDiffWAvg5": float(home_xg5["xgDiffWAvg5"]),
            "away_xg5_sampleSize": float(away_xg5["sampleSize"]),
            "away_xg5_xgForAvg5": float(away_xg5["xgForAvg5"]),
            "away_xg5_xgAgainstAvg5": float(away_xg5["xgAgainstAvg5"]),
            "away_xg5_xgDiffAvg5": float(away_xg5["xgDiffAvg5"]),
            "away_xg5_xgForWAvg5": float(away_xg5["xgForWAvg5"]),
            "away_xg5_xgAgainstWAvg5": float(away_xg5["xgAgainstWAvg5"]),
            "away_xg5_xgDiffWAvg5": float(away_xg5["xgDiffWAvg5"]),

            # xg10 unweighted + weighted
            "home_xg10_sampleSize": float(home_xg10["sampleSize"]),
            "home_xg10_xgForAvg10": float(home_xg10["xgForAvg10"]),
            "home_xg10_xgAgainstAvg10": float(home_xg10["xgAgainstAvg10"]),
            "home_xg10_xgDiffAvg10": float(home_xg10["xgDiffAvg10"]),
            "home_xg10_xgForWAvg10": float(home_xg10["xgForWAvg10"]),
            "home_xg10_xgAgainstWAvg10": float(home_xg10["xgAgainstWAvg10"]),
            "home_xg10_xgDiffWAvg10": float(home_xg10["xgDiffWAvg10"]),
            "away_xg10_sampleSize": float(away_xg10["sampleSize"]),
            "away_xg10_xgForAvg10": float(away_xg10["xgForAvg10"]),
            "away_xg10_xgAgainstAvg10": float(away_xg10["xgAgainstAvg10"]),
            "away_xg10_xgDiffAvg10": float(away_xg10["xgDiffAvg10"]),
            "away_xg10_xgForWAvg10": float(away_xg10["xgForWAvg10"]),
            "away_xg10_xgAgainstWAvg10": float(away_xg10["xgAgainstWAvg10"]),
            "away_xg10_xgDiffWAvg10": float(away_xg10["xgDiffWAvg10"]),

            # derived gaps
            "derived_pointsGap5": derived_pointsGap5,
            "derived_goalForGap5": derived_goalForGap5,
            "derived_goalsAgainstGap5": derived_goalsAgainstGap5,
            "derived_homeSample5": float(home_form5["matches"]),
            "derived_awaySample5": float(away_form5["matches"]),
            "derived_pointsGapW5": derived_pointsGapW5,
            "derived_goalForGapW5": derived_goalForGapW5,
            "derived_goalsAgainstGapW5": derived_goalsAgainstGapW5,

            # derived tempo (unweighted + weighted)
            "derived_expectedGoalsTotal5": derived_expectedGoalsTotal5,
            "derived_expectedGoalsAsym5": derived_expectedGoalsAsym5,
            "derived_expectedGoalsTotal10": derived_expectedGoalsTotal10,
            "derived_expectedGoalsAsym10": derived_expectedGoalsAsym10,
            "derived_expectedGoalsTotalW5": derived_expectedGoalsTotalW5,
            "derived_expectedGoalsAsymW5": derived_expectedGoalsAsymW5,
            "derived_expectedGoalsTotalW10": derived_expectedGoalsTotalW10,
            "derived_expectedGoalsAsymW10": derived_expectedGoalsAsymW10,
        }

        for lid in league_ids_sorted:
            feat[f"lg_{lid}"] = 1.0 if league_id == lid else 0.0

        out_rows.append(
            {
                "fixtureId": fixture_id,
                "kickoffTs": kickoff_ts,
                **feat,
                "label_result": int(label_result),
                "label_over25": int(label_over25),
                "label_btts": int(label_btts),
            }
        )

    return pd.DataFrame(out_rows)

