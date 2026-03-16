## 2026-03-16 weekly refresh
- Log: `logs/lightgbm/run_2026-03-16T081022Z.log` (12,295 fixtures fetched; 67.1% include xG)
- Dataset: 9,544 training rows, 120 features (36 xG/tempo, 84 form/other); mean xG NaN rate 19.3% vs ~0 for non-xG.
- RESULT: multi_logloss 1.0186, accuracy 0.486 (best_iteration 62).
- OVER25: logloss 0.6843 @ iter 26; calibrated threshold 0.48 (bal_acc 0.560, F1 0.635, acc 0.572). Form-only diagnostic degraded slightly (logloss 0.6865).
- BTTS: logloss 0.6845 @ iter 5 with prob range 0.48–0.60; calibrated threshold 0.52 (bal_acc 0.517, F1 0.695, acc 0.566). Confirms need for TASK_0007 gating/loosening.

# TASK_0002 — Model improvement scratchpad

_Last updated: 2026-03-12 10:06 UTC_

## Latest evaluation sample (fixtures_archive, archived 2026-03-11)

| Fixture ID | Match | Actual result | Pred picks | Correct? |
| --- | --- | --- | --- | --- |
| 19432179 | Birmingham City 1-0 QPR | Result H / BTTS N / Over N | Result H / BTTS Y / Over Y | ✅❌❌ |
| 19432182 | Norwich City 2-1 Sheffield United | Result H / BTTS Y / Over Y | Result H / BTTS Y / Over Y | ✅✅✅ |
| 19432187 | Coventry City 3-0 Preston | Result H / BTTS N / Over Y | Result H / BTTS Y / Over Y | ✅❌✅ |
| 19432188 | Middlesbrough 0-1 Charlton | Result A / BTTS N / Over N | Result H / BTTS Y / Over Y | ❌❌❌ |
| 19432189 | Oxford United 1-0 Blackburn | Result H / BTTS N / Over N | Result H / BTTS Y / Over N | ✅❌✅ |

Accuracy over the five fixtures: **Result 4/5, Over2.5 3/5, BTTS 1/5.** Model is still over-committing to BTTS=Y even in low-total matches, suggesting the classification threshold or input features remain misaligned.

### Fixture research (2026-03-11 sample)

- All five fixtures were in the Championship with heavy home favourites (home implied win probabilities 56–73%). Away sides sat 12th-23rd in the table and produced a combined one goal, yet BTTS was predicted "Y" across the board.
- Middlesbrough (2nd) vs Charlton (18th) finished 0-1 because Boro generated 0 goals on the night; without rest/position suppression features, the BTTS headroom stayed too high despite Charlton's low scoring trend.
- Birmingham vs QPR and Oxford vs Blackburn both closed 1-0 with moneyline odds implying <35% away win probability, reinforcing that the classifier should lean toward BTTS="N" when market totals skew under 2.25 and one side struggles for goals.
- Coventry vs Preston hit over 2.5 solely via the favourite; Preston never threatened. Model needs a way to down-weight BTTS when the underdog attack quality is weak, even if the favourite is prolific.


## Evaluation sample (fixtures_archive, archived 2026-03-04)

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
