import * as admin from "firebase-admin";
import { extractCurrentGoals } from "../sportmonks/extractGoals";
import { ENV } from "../config";

type Participant = {
  id: number;
  name: string;
  short_code?: string | null;
  image_path?: string | null;
  country_id?: number | null;
  founded?: number | null;
  last_played_at?: string | null;
  meta?: { location?: "home" | "away"; position?: number | null };
};

type Fixture = {
  id: number;
  league_id: number;
  season_id: number;
  stage_id?: number | null;
  round_id?: number | null;
  state_id: number;
  venue_id?: number | null;
  name: string;
  starting_at: string;
  starting_at_timestamp: number;
  has_odds: boolean;
  has_premium_odds: boolean;
  state?: { id: number; short_name?: string; name?: string; state?: string };
  participants?: Participant[];
  odds?: unknown[];
  scores?: unknown[];
  league?: {
    id?: number;
    name?: string;
    short_code?: string | null;
    short_code_2?: string | null;
  };
};

type PaginationShape = {
  has_more?: boolean;
  current_page?: number;
  next_page?: number;
  total_pages?: number;
};

const FINISHED_STATES = new Set([
  "FT",
  "AET",
  "PEN",
  "DELETED",
  "ABANDONED",
  "CANCELED",
  "SUSPENDED",
]);

function isFinished(shortName?: string) {
  if (!shortName) return false;
  return FINISHED_STATES.has(shortName);
}

function formatDateUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(d: Date, days: number) {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function extractHomeAway(participants: Participant[]) {
  const home = participants.find((p) => p.meta?.location === "home");
  const away = participants.find((p) => p.meta?.location === "away");
  if (!home || !away) return null;

  return {
    home,
    away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homePosition: home.meta?.position ?? null,
    awayPosition: away.meta?.position ?? null,
  };
}

function safeLeagueName(f: Fixture) {
  const n = (f as any)?.league?.name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return String(f.league_id);
}

function getPagination(json: any): PaginationShape | null {
  // SportMonks responses can vary by endpoint/version:
  // some use json.pagination, some use json.meta.pagination
  return (json?.pagination ??
    json?.meta?.pagination ??
    null) as PaginationShape | null;
}

/**
 * Sync fixtures for next N days into fixtures_live
 * Also maintains fixture_details/{fixtureId} (denormalised view doc)
 */
export async function syncFixturesWindow(token: string) {
  const db = admin.firestore();

  console.log("LOOKAHEAD_DAYS (code) =", ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS);
  console.log("LOOKAHEAD_DAYS (env)  =", process.env.FIXTURE_LOOKAHEAD_DAYS);

  const start = new Date();
  const end = addDaysUTC(start, ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS);

  // ✅ IMPORTANT: make the API end date inclusive-safe (avoids “last day missing”)
  const endForApi = addDaysUTC(end, 1);

  const startStr = formatDateUTC(start);
  const endStr = formatDateUTC(end); // what you *mean* (window)
  const endStrApi = formatDateUTC(endForApi); // what you *query*

  // include league so we can persist league name for fixture details
  const include = "state;participants;odds;league;scores";

  console.log(
    `Syncing fixtures between ${startStr} and ${endStr} (API query end=${endStrApi})...`,
  );

  // In-run set to avoid upserting same team repeatedly
  const seenTeams = new Set<number>();

  // Track which fixtures SportMonks actually returned this run
  const seenFixtureIds = new Set<string>();

  // Exclude cup competitions
  const ALLOWED_LEAGUE_IDS = new Set<number>([
    8, 9, 72, 82, 181, 208, 244, 271, 301, 384, 387, 444, 453, 462, 501, 564,
    567, 573, 591, 600,
  ]);

  // ✅ Pagination: don’t assume total_pages exists
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url =
      `${ENV.SPORTSMONKS.BASE_URL}/fixtures/between/${startStr}/${endStrApi}` +
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

    // Fallback behaviour if the API doesn’t provide has_more:
    // - if we got 0 fixtures, stop
    // - otherwise, keep going *one more page* and rely on the 0 page to stop
    hasMore = hasMoreFromApi ?? fixtures.length > 0;

    const totalPagesMaybe =
      typeof pagination?.total_pages === "number"
        ? pagination.total_pages
        : undefined;

    console.log(
      `Page ${page}${totalPagesMaybe ? `/${totalPagesMaybe}` : ""}: ${
        fixtures.length
      } fixtures (hasMore=${String(hasMoreFromApi ?? "unknown")})`,
    );

    // 🔎 One-run counters to explain “why do I have so few fixtures?”
    let total = 0;
    let notAllowedLeague = 0;
    let missingParticipants = 0;
    let postponed = 0;
    let finished = 0;
    let nonNS = 0;
    let written = 0;

    let batch = db.batch();
    let ops = 0;

    for (const f of fixtures) {
      total++;

      // Filter leagues early
      if (!ALLOWED_LEAGUE_IDS.has(f.league_id)) {
        notAllowedLeague++;
        continue;
      }

      const fixtureId = String(f.id);
      seenFixtureIds.add(fixtureId);

      const short = f.state?.short_name ?? undefined;

      const participants = f.participants ?? [];
      const mapped = extractHomeAway(participants);
      if (!mapped) {
        missingParticipants++;
        console.warn(
          `Fixture ${f.id} missing home/away participants; skipping`,
        );
        continue;
      }

      // --- POSTPONED RULE ---
      if (short === "POSTPONED") {
        postponed++;

        const liveRef = db.collection("fixtures_live").doc(fixtureId);
        const predRef = db.collection("predictions_live").doc(fixtureId);
        const detailsRef = db.collection("fixture_details").doc(fixtureId);

        batch.delete(liveRef);
        batch.delete(predRef);
        batch.delete(detailsRef);
        ops += 3;

        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }

        continue;
      }

      // ✅ Finished fixtures go to archive (not live)
      if (isFinished(short)) {
        finished++;
        // (we still upsert archive + details below)
      } else {
        // keep NS-only in fixtures_live (your current rule)
        if (short && short !== "NS") {
          nonNS++;
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

        ops++;
        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
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

        // Window markers (store the “meaningful” end)
        inWindow: true,
        windowStart: startStr,
        windowEnd: endStr,

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
        // archive finished
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

        // remove from live fixtures
        batch.delete(liveRef);

        // keep fixture_details so a user can still open it
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

        ops += 3;
      } else {
        // fixtures_live
        batch.set(liveRef, fixturePayload, { merge: true });
        ops++;
        written++;

        // fixture_details
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
        ops++;
      }

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) await batch.commit();

    console.log("Fixture filter counts", {
      page,
      total,
      notAllowedLeague,
      missingParticipants,
      postponed,
      finished,
      nonNS,
      written,
    });

    page++;
    // if API didn’t tell us has_more, stop when we hit an empty page
    if (hasMoreFromApi == null && fixtures.length === 0) hasMore = false;
  }

  // ✅ PRUNE: delete live fixtures (and their predictions + details) that were previously in this window
  // but are no longer returned by SportMonks (common for postponed/rescheduled fixtures).
  {
    console.log(`Pruning fixtures_live for window ${startStr}..${endStr}...`);

    const liveSnap = await db
      .collection("fixtures_live")
      .where("inWindow", "==", true)
      .where("windowStart", "==", startStr)
      .where("windowEnd", "==", endStr)
      .get();

    let batch = db.batch();
    let ops = 0;
    let pruned = 0;

    for (const docSnap of liveSnap.docs) {
      if (!seenFixtureIds.has(docSnap.id)) {
        const predRef = db.collection("predictions_live").doc(docSnap.id);
        const detailsRef = db.collection("fixture_details").doc(docSnap.id);

        batch.delete(docSnap.ref);
        batch.delete(predRef);
        batch.delete(detailsRef);

        pruned++;
        ops += 3;

        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }

    if (ops > 0) await batch.commit();
    console.log(`Pruned ${pruned} stale fixtures (and predictions + details).`);
  }

  console.log("Fixture sync complete.");
}
