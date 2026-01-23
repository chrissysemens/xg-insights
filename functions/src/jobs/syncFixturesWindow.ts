import * as admin from "firebase-admin";
import { extractCurrentGoals } from "../sportmonks/extractGoals";
import { ENV } from "../config";
import { addDaysUTC, formatDateUTC } from "../utils/date";
import { Fixture } from "../types";
import {
  extractHomeAway,
  getPagination,
  isFinished,
  safeLeagueName,
} from "../utils/helpers";

/**
 * Sync fixtures for next N days into fixtures_live
 * Also maintains fixture_details/{fixtureId} (denormalised view doc)
 */
export async function syncFixturesWindow(token: string) {
  const db = admin.firestore();

  const windowStart = new Date();
  const windowEnd = addDaysUTC(windowStart, ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS);

  const windowStartStr = formatDateUTC(windowStart);
  const windowEndStr = formatDateUTC(windowEnd);

  // Sports monks includes:
  const include = "state;participants;odds;league;scores";

  const seenTeams = new Set<number>();
  const seenFixtureIds = new Set<string>();

  // Excluded competitions:
  const ALLOWED_LEAGUE_IDS = new Set<number>([
    8, 9, 72, 82, 181, 208, 244, 271, 301, 384, 387, 444, 453, 462, 501, 564,
    567, 573, 591, 600,
  ]);

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url =
      `${ENV.SPORTSMONKS.BASE_URL}/fixtures/between/${windowStartStr}/${windowEndStr}` +
      `?api_token=${encodeURIComponent(token)}` +
      `&include=${encodeURIComponent(include)}` +
      `&page=${page}`;

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`SportMonks error ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = await res.json();
    const fixtures: Fixture[] = json?.data ?? [];

    const pagination = getPagination(json);
    const hasMoreFromApi =
      typeof pagination?.has_more === "boolean" ? pagination.has_more : null;

    hasMore = hasMoreFromApi ?? fixtures.length > 0;


    let batch = db.batch();
    let operations = 0;

    for (const f of fixtures) {

      // Filter leagues
      if (!ALLOWED_LEAGUE_IDS.has(f.league_id)) {
        continue;
      }

      const fixtureId = String(f.id);
      seenFixtureIds.add(fixtureId);

      const short = f.state?.short_name ?? undefined;

      const participants = f.participants ?? [];
      const mapped = extractHomeAway(participants);
      if (!mapped) {
        // Missing home/away info: skip
        continue;
      }

      // Handle postponed fixtures: Remove from all
      if (short === "POSTPONED") {
        const liveRef = db.collection("fixtures_live").doc(fixtureId);
        const predRef = db.collection("predictions_live").doc(fixtureId);
        const detailsRef = db.collection("fixture_details").doc(fixtureId);

        batch.delete(liveRef);
        batch.delete(predRef);
        batch.delete(detailsRef);
        operations += 3;

        if (operations >= 450) {
          await batch.commit();
          batch = db.batch();
          operations = 0;
        }

        continue;
      }

      // Archive finished fixtures:
      if (!isFinished(short)) {
        // keep NS-only in fixtures_live (your current rule)
        if (short && short !== "NS") {
          continue;
        }
      }

      // Upsert teams (once per run per team)
      for (const t of [mapped.home, mapped.away]) {
        if (seenTeams.has(t.id)) continue;
        seenTeams.add(t.id);

        const teamRef = db.collection("teams").doc(String(t.id));
        batch.set(
          teamRef,
          {
            id: t.id,
            name: t.name,
            shortCode: t.short_code ?? null,
            imagePath: t.image_path ?? null,
            countryId: t.country_id ?? null,
            founded: t.founded ?? null,
            lastPlayedAt: t.last_played_at ?? null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        operations++;
        if (operations >= 450) {
          await batch.commit();
          batch = db.batch();
          operations = 0;
        }
      }

      const startingAtISO = new Date(
        f.starting_at_timestamp * 1000,
      ).toISOString();

      const goals = extractCurrentGoals({
        participants: f.participants,
        scores: (f as any).scores,
      });

      const leagueName = safeLeagueName(f);
      const leagueBlock = {
        id: f.league_id,
        name: leagueName,
      };

      const fixturePayload: any = {
        id: f.id,
        leagueId: f.league_id,
        leagueName,
        seasonId: f.season_id,
        stageId: f.stage_id ?? null,
        roundId: f.round_id ?? null,
        stateId: f.state_id,
        venueId: f.venue_id ?? null,
        name: f.name,
        startingAt: startingAtISO,
        startingAtTimestamp: f.starting_at_timestamp,
        hasOdds: !!f.has_odds,
        hasPremiumOdds: !!f.has_premium_odds,

        homeTeamId: mapped.homeTeamId,
        awayTeamId: mapped.awayTeamId,
        homePosition: mapped.homePosition,
        awayPosition: mapped.awayPosition,

        state: f.state
          ? {
              id: f.state.id,
              shortName: f.state.short_name ?? undefined,
              name: f.state.name ?? undefined,
            }
          : null,

        oddsAvailable: Array.isArray(f.odds) && f.odds.length > 0,

        inWindow: true,
        windowStart: windowStartStr,
        windowEnd: windowEndStr,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (goals) {
        fixturePayload.homeGoals = goals.homeGoals;
        fixturePayload.awayGoals = goals.awayGoals;
      }

      const liveRef = db.collection("fixtures_live").doc(fixtureId);
      const archRef = db.collection("fixtures_archive").doc(fixtureId);
      const detailsRef = db.collection("fixture_details").doc(fixtureId);

      if (isFinished(short)) {
        // Archive finished fixtures
        batch.set(
          archRef,
          {
            ...fixturePayload,
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            stateShortName: f.state?.short_name ?? null,
            evaluationDone: false,
          },
          { merge: true },
        );

        // Remove from live
        batch.delete(liveRef);

        // Keep fixture details
        batch.set(
          detailsRef,
          {
            fixtureId,
            startingAtTimestamp: f.starting_at_timestamp,
            league: leagueBlock,
            home: {
              id: mapped.home.id,
              name: mapped.home.name,
              imagePath: mapped.home.image_path ?? null,
            },
            away: {
              id: mapped.away.id,
              name: mapped.away.name,
              imagePath: mapped.away.image_path ?? null,
            },
            score:
              goals != null
                ? { homeGoals: goals.homeGoals, awayGoals: goals.awayGoals }
                : admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        operations += 3;
      } else {
        // Fixtures live
        batch.set(liveRef, fixturePayload, { merge: true });
        operations++;

        // Fixture details
        batch.set(
          detailsRef,
          {
            fixtureId,
            startingAtTimestamp: f.starting_at_timestamp,
            league: leagueBlock,
            home: {
              id: mapped.home.id,
              name: mapped.home.name,
              imagePath: mapped.home.image_path ?? null,
            },
            away: {
              id: mapped.away.id,
              name: mapped.away.name,
              imagePath: mapped.away.image_path ?? null,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        operations++;
      }

      if (operations >= 450) {
        await batch.commit();
        batch = db.batch();
        operations = 0;
      }
    }

    if (operations > 0) await batch.commit();

    page++;
    if (hasMoreFromApi == null && fixtures.length === 0) hasMore = false;
  }

  // Prune stale fixtures from live:
  const liveSnap = await db
    .collection("fixtures_live")
    .where("inWindow", "==", true)
    .where("windowStart", "==", windowStart)
    .where("windowEnd", "==", windowEndStr)
    .get();

  let batch = db.batch();
  let operations = 0;
  let pruned = 0;

  for (const docSnap of liveSnap.docs) {
    if (!seenFixtureIds.has(docSnap.id)) {
      const predRef = db.collection("predictions_live").doc(docSnap.id);
      const detailsRef = db.collection("fixture_details").doc(docSnap.id);

      batch.delete(docSnap.ref);
      batch.delete(predRef);
      batch.delete(detailsRef);

      pruned++;
      operations += 3;

      if (operations >= 450) {
        await batch.commit();
        batch = db.batch();
        operations = 0;
      }
    }
  }
  if (operations > 0) await batch.commit();
}
