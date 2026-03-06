# TASK_0002 — Model improvement scratchpad

_Last updated: 2026-03-06 16:06 UTC_

## Latest evaluation sample (fixtures_archive, archived 2026-03-04)

| Fixture ID | Match | Actual result | Pred picks | Correct? |
| --- | --- | --- | --- | --- |
| 19427165 | Aston Villa 1-4 Chelsea | Result A / BTTS Y / Over Y | Result A / BTTS Y / Over Y | ✅✅✅ |
| 19427167 | Brighton 0-1 Arsenal | Result A / BTTS N / Over N | Result A / BTTS Y / Over Y | ✅❌❌ |
| 19427169 | Fulham 0-1 West Ham | Result A / BTTS N / Over N | Result H / BTTS Y / Over Y | ❌❌❌ |
| 19427171 | Man City 2-2 N. Forest | Result D / BTTS Y / Over Y | Result H / BTTS N / Over Y | ❌❌✅ |
| 19428183 | Aberdeen 1-2 Celtic | Result A / BTTS Y / Over Y | Result A / BTTS Y / Over Y | ✅✅✅ |

Accuracy over the five sample fixtures: **Result 3/5, Over2.5 3/5, BTTS 2/5.** BTTS is consistently the weakest dimension.

## Code audit highlights

1. **Feature mismatch (inference vs training).**
   - `functions/src/utils/helpers.ts` emits extra inputs (`home_position`, `away_position`, `derived_positionGap`, `home_restDays`, `away_restDays`, `derived_restGap`, `derived_bttsSuppress5`, `derived_bttsSuppress10`).
   - These columns do **not** appear in `cloudrun-predictor/model/feature_names.json`, so `feature_flatten.build_matrix` drops them before feeding LightGBM. Training definitions in `trainer/build_dataset.py` also omit them.
   - The missing BTTS suppression signal explains why low-scoring fixtures (Brighton–Arsenal, Fulham–West Ham) were still flagged as “Y”.

2. **Single global thresholds.** `app/main.py` currently reads one BTTS/Over threshold for every league. Once we fix the feature gap, we should also consider league-aware calibration (EPL vs Serie A have different scoring baselines).

## Next steps

- Patch `trainer/build_dataset.py` + `feature_names.json` to include the missing rest/position/bttsSuppress features, then re-export the predictor bundle.
- Re-run calibration to pick new `btts_threshold` (may land closer to 0.53 once the new features are in play).
- Ship a small PR wiring the new feature columns through the trainer + predictor; validate on a fresh `fixtures_archive` slice before merge.

## SportMonks fetch resilience (2026-03-06 08:31 UTC)

- `trainer/train_models.py` died on schedules page 2912 with a 429 during `fixtures_by_season` pagination.
- Fix plan: cap pagination per season (e.g., stop after ~200 pages unless pagination.has_more is explicitly true), honor Retry-After delays, and cache previously-downloaded schedules locally so reruns skip API hits.
- Once guard is in place, rerun the trainer with cached fixtures to unblock the PR step.
- 2026-03-06 10:41 UTC: Added fixture-id cache + configurable page cap inside trainer/sportmonks.py; env `SPORTMONKS_MAX_SCHEDULE_PAGES` defaults to 400 and cache lives under trainer/.cache/schedules.
- 2026-03-06 12:43 UTC: Trainer rerun aborted on EPL season 19793 at page 201 (429). Need to add per-page throttle / Retry-After enforcement or resume-from-cache to avoid re-fetching when rate-limited.
- 2026-03-06 13:13 UTC: Updated sportmonks.py to add per-page sleep + retry env flags (`SPORTMONKS_PAGE_SLEEP_SECONDS`, `SPORTMONKS_PAGE_RETRIES`, `SPORTMONKS_PAGE_RETRY_SLEEP`) so we back off before hitting 429 again.
- 2026-03-06 15:31 UTC: Killing the 1.5s/page training run after confirming it would take ~10m per 400-page season; next launch will drop to 0.15s/page while keeping higher retries/backoff.
- 2026-03-06 16:06 UTC: Completed retrain with 0.15s SportMonks page sleeps (no 429s). Exported new models under cloudrun-predictor/model with Over25 threshold 0.45 and BTTS 0.49.
