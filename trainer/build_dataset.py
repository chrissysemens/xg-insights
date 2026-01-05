from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np


def extract_final_score(scores: List[Dict[str, Any]], home_id: int, away_id: int) -> Optional[Tuple[int, int]]:
    """
    Returns (home_goals, away_goals) using description == "CURRENT".
    """
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


def extract_home_away_ids(participants: List[Dict[str, Any]]) -> Optional[Tuple[int, int]]:
    """
    SportMonks participants include meta.location = home/away
    """
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


def build_team_form(last_n_matches: List[Dict[str, Any]], team_id: int) -> Dict[str, float]:
    """
    last_n_matches: list of completed matches for this team before a target fixture.
    Each match dict must have: homeTeamId, awayTeamId, homeGoals, awayGoals
    """
    n = len(last_n_matches)
    if n == 0:
        return {
            "matches": 0,
            "pointsAvg5": np.nan,
            "goalsForAvg5": np.nan,
            "goalsAgainstAvg5": np.nan,
            "winRate5": np.nan,
            "drawRate5": np.nan,
            "lossRate5": np.nan,
        }

    pts = 0
    gf_total = 0
    ga_total = 0
    wins = draws = losses = 0

    for m in last_n_matches:
        is_home = m["homeTeamId"] == team_id
        gf = m["homeGoals"] if is_home else m["awayGoals"]
        ga = m["awayGoals"] if is_home else m["homeGoals"]

        gf_total += gf
        ga_total += ga
        p = points_for_result(gf, ga)
        pts += p
        if p == 3:
            wins += 1
        elif p == 1:
            draws += 1
        else:
            losses += 1

    return {
        "matches": n,
        "pointsAvg5": pts / n,
        "goalsForAvg5": gf_total / n,
        "goalsAgainstAvg5": ga_total / n,
        "winRate5": wins / n,
        "drawRate5": draws / n,
        "lossRate5": losses / n,
    }


def build_dataset(fixtures_raw: List[Dict[str, Any]], league_ids: List[int]) -> pd.DataFrame:
    """
    fixtures_raw: SportMonks fixtures with includes participants;scores;state
    Produces rows where each row represents a fixture with:
      - features for home/away from previous 5 matches each
      - labels from final score
      - league one-hot features (lg_<id>)
    """

    league_set = set(int(x) for x in league_ids)

    rows = []
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

        rows.append({
            "fixtureId": int(f["id"]),
            "kickoffTs": kickoff_ts,
            "leagueId": lid,
            "homeTeamId": home_id,
            "awayTeamId": away_id,
            "homeGoals": hg,
            "awayGoals": ag,
        })

    base = pd.DataFrame(rows)
    if base.empty:
        return base

    base = base.sort_values("kickoffTs").reset_index(drop=True)

    # Build per-team match history index (for fast lookup)
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

    # Ensure each team list sorted by kickoff
    for tid in matches_by_team:
        matches_by_team[tid].sort(key=lambda x: x["kickoffTs"])

    # Stable list of league ids for one-hot feature columns
    league_ids_sorted = sorted(league_set)

    out_rows = []
    for r in base.itertuples(index=False):
        fixture_id = int(r.fixtureId)
        kickoff_ts = int(r.kickoffTs)
        league_id = int(r.leagueId)
        home_id = int(r.homeTeamId)
        away_id = int(r.awayTeamId)

        # prior matches only (kickoff < current kickoff)
        home_hist = [m for m in matches_by_team.get(home_id, []) if m["kickoffTs"] < kickoff_ts]
        away_hist = [m for m in matches_by_team.get(away_id, []) if m["kickoffTs"] < kickoff_ts]

        home_last5 = home_hist[-5:]
        away_last5 = away_hist[-5:]

        # V1: require 5 prior matches each (clean training)
        if len(home_last5) < 5 or len(away_last5) < 5:
            continue

        home_form = build_team_form(home_last5, home_id)
        away_form = build_team_form(away_last5, away_id)

        # labels
        hg = int(r.homeGoals)
        ag = int(r.awayGoals)

        # result label encoding: H=0, D=1, A=2
        if hg > ag:
            label_result = 0
        elif hg == ag:
            label_result = 1
        else:
            label_result = 2

        label_over25 = 1 if (hg + ag) >= 3 else 0
        label_btts = 1 if (hg > 0 and ag > 0) else 0

        derived = {
            "pointsGap5": float(home_form["pointsAvg5"] - away_form["pointsAvg5"]),
            "goalForGap5": float(home_form["goalsForAvg5"] - away_form["goalsForAvg5"]),
            "goalsAgainstGap5": float(home_form["goalsAgainstAvg5"] - away_form["goalsAgainstAvg5"]),
            "homeSample5": float(home_form["matches"]),
            "awaySample5": float(away_form["matches"]),
        }

        feat = {
            # home
            "home_form5_matches": home_form["matches"],
            "home_form5_pointsAvg5": home_form["pointsAvg5"],
            "home_form5_goalsForAvg5": home_form["goalsForAvg5"],
            "home_form5_goalsAgainstAvg5": home_form["goalsAgainstAvg5"],
            "home_form5_winRate5": home_form["winRate5"],
            "home_form5_drawRate5": home_form["drawRate5"],
            "home_form5_lossRate5": home_form["lossRate5"],
            # away
            "away_form5_matches": away_form["matches"],
            "away_form5_pointsAvg5": away_form["pointsAvg5"],
            "away_form5_goalsForAvg5": away_form["goalsForAvg5"],
            "away_form5_goalsAgainstAvg5": away_form["goalsAgainstAvg5"],
            "away_form5_winRate5": away_form["winRate5"],
            "away_form5_drawRate5": away_form["drawRate5"],
            "away_form5_lossRate5": away_form["lossRate5"],
            # derived
            "derived_pointsGap5": derived["pointsGap5"],
            "derived_goalForGap5": derived["goalForGap5"],
            "derived_goalsAgainstGap5": derived["goalsAgainstGap5"],
            "derived_homeSample5": derived["homeSample5"],
            "derived_awaySample5": derived["awaySample5"],
        }

        # League one-hot
        for lid in league_ids_sorted:
            feat[f"lg_{lid}"] = 1.0 if league_id == lid else 0.0

        out_rows.append({
            "fixtureId": fixture_id,
            "kickoffTs": kickoff_ts,
            **feat,
            "label_result": label_result,
            "label_over25": label_over25,
            "label_btts": label_btts,
        })

    return pd.DataFrame(out_rows)
