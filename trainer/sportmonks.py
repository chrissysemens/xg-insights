# sportmonks.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Dict, Any, Optional
import json
import os
from pathlib import Path
import time
import requests

CACHE_DIR = Path(__file__).resolve().parent / ".cache" / "schedules"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
PAGE_SLEEP_SECONDS = float(os.environ.get("SPORTMONKS_PAGE_SLEEP_SECONDS", "0.5"))
PAGE_RETRY_LIMIT = int(os.environ.get("SPORTMONKS_PAGE_RETRIES", "3"))
PAGE_RETRY_SLEEP = float(os.environ.get("SPORTMONKS_PAGE_RETRY_SLEEP", "5"))


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


def _pagination_has_more(pagination: Dict[str, Any], current_page: int, count: int) -> bool:
    has_more = pagination.get("has_more")
    if isinstance(has_more, bool):
        return has_more

    cur = int(
        pagination.get("current_page")
        or pagination.get("currentPage")
        or pagination.get("page")
        or current_page
    )

    last_raw = (
        pagination.get("last_page")
        or pagination.get("lastPage")
        or pagination.get("total_pages")
        or pagination.get("totalPages")
    )
    try:
        last = int(last_raw)
    except Exception:
        last = -1

    if last > 0:
        return cur < last

    return count > 0


def seasons_for_league(client: SMClient, league_id: int) -> List[Dict[str, Any]]:
    # Fetch the league and include its seasons
    url = f"{client.base_url}/leagues/{league_id}?api_token={client.token}&include=seasons"
    j = client.get_json(url)

    # Response is usually { "data": {...} }
    league = j.get("data", {})
    return league.get("seasons", []) or []


def fixtures_by_season(
    client: SMClient,
    season_id: int,
    include: str | None = None,
    max_pages: Optional[int] = None,
    use_cache: bool = True,
) -> List[Dict[str, Any]]:
    """
    SportMonks v3: there is no /fixtures/season/{season_id}.
    Correct flow:
      1) GET /schedules/seasons/{season_id}  -> get fixture ids
      2) GET /fixtures/multi/{ids...}        -> fetch full fixture objects (50 ids max)
    """
    fixture_ids: List[int] = []
    cache_path = CACHE_DIR / f"season_{season_id}_fixtures.json"
    cache_hit = False

    if use_cache and cache_path.exists():
        try:
            with cache_path.open() as fh:
                cached = json.load(fh)
            if isinstance(cached, list):
                fixture_ids = [int(x) for x in cached]
                cache_hit = True
        except Exception:
            fixture_ids = []
            cache_hit = False

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

    # 1) schedule pages (skipped when cache already satisfied)
    if not cache_hit:
        page = 1
        has_more = True
        cap = max_pages if max_pages is not None else int(os.environ.get("SPORTMONKS_MAX_SCHEDULE_PAGES", "400"))

        while has_more:
            if cap and page > cap:
                print(f"[sportmonks] cap {cap} reached for season {season_id}; stopping pagination early")
                break

            schedule_url = (
                f"{client.base_url}/schedules/seasons/{season_id}"
                f"?api_token={client.token}&page={page}"
            )

            retries = 0
            while True:
                try:
                    schedule = client.get_json(schedule_url)
                    break
                except RuntimeError as err:
                    retries += 1
                    if retries >= max(1, PAGE_RETRY_LIMIT):
                        raise
                    sleep_for = PAGE_RETRY_SLEEP * retries
                    print(
                        f"[sportmonks] retrying season {season_id} page {page} after error: {err}. "
                        f"Sleeping {sleep_for:.1f}s"
                    )
                    time.sleep(sleep_for)

            walk(schedule.get("data", schedule))

            pagination = schedule.get("pagination") or (schedule.get("meta") or {}).get("pagination") or {}
            page_count = len(schedule.get("data") or []) if isinstance(schedule.get("data"), list) else 1

            if not pagination:
                has_more = False
            else:
                has_more = _pagination_has_more(pagination, page, page_count)
                page += 1

            if page_count == 0:
                has_more = False

            if PAGE_SLEEP_SECONDS > 0:
                time.sleep(PAGE_SLEEP_SECONDS)

        if use_cache and fixture_ids:
            try:
                with cache_path.open("w") as fh:
                    json.dump(sorted(set(fixture_ids)), fh)
            except Exception:
                pass

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
