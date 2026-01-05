# sportmonks.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Dict, Any, Optional
import time
import requests


@dataclass
class SMClient:
    token: str
    base_url: str = "https://api.sportmonks.com/v3/football"
    retries: int = 3
    timeout: int = 30
    backoff_seconds: float = 1.2

    def get_json(self, url: str) -> Dict[str, Any]:
        last_err: Optional[Exception] = None

        for attempt in range(1, self.retries + 1):
            try:
                r = requests.get(url, timeout=self.timeout)
                r.raise_for_status()
                return r.json()
            except Exception as e:
                last_err = e

                # If we get rate-limited, respect Retry-After if present
                retry_after = None
                try:
                    if hasattr(e, "response") and e.response is not None:
                        retry_after = e.response.headers.get("Retry-After")
                except Exception:
                    retry_after = None

                if attempt < self.retries:
                    sleep_for = float(retry_after) if retry_after else (self.backoff_seconds * attempt)
                    time.sleep(sleep_for)
                else:
                    break

        raise RuntimeError(f"GET failed after retries: {url}") from last_err


def _chunked(items: List[int], size: int) -> Iterable[List[int]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def seasons_for_league(client: SMClient, league_id: int) -> List[Dict[str, Any]]:
    # Fetch the league and include its seasons
    url = f"{client.base_url}/leagues/{league_id}?api_token={client.token}&include=seasons"
    j = client.get_json(url)

    # Response is usually { "data": {...} }
    league = j.get("data", {})
    return league.get("seasons", []) or []

def fixtures_by_season(client: SMClient, season_id: int, include: str | None = None) -> List[Dict[str, Any]]:
    """
    SportMonks v3: there is no /fixtures/season/{season_id}.
    Correct flow:
      1) GET /schedules/seasons/{season_id}  -> get fixture ids
      2) GET /fixtures/multi/{ids...}        -> fetch full fixture objects (50 ids max)
    """
    # 1) schedule
    schedule_url = f"{client.base_url}/schedules/seasons/{season_id}?api_token={client.token}"
    schedule = client.get_json(schedule_url)

    fixture_ids: List[int] = []

    def walk(obj: Any):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k == "fixtures" and isinstance(v, list):
                    for fx in v:
                        if isinstance(fx, dict) and "id" in fx:
                            fixture_ids.append(int(fx["id"]))
                else:
                    walk(v)
        elif isinstance(obj, list):
            for x in obj:
                walk(x)

    walk(schedule.get("data", schedule))

    fixture_ids = sorted(set(fixture_ids))
    if not fixture_ids:
        return []

    # 2) fetch fixtures in batches of 50
    out: List[Dict[str, Any]] = []
    for batch in _chunked(fixture_ids, 50):
        ids = ",".join(str(i) for i in batch)
        url = f"{client.base_url}/fixtures/multi/{ids}?api_token={client.token}"
        if include:
            url += f"&include={include}"
        j = client.get_json(url)
        out.extend(j.get("data", []))

    return out
