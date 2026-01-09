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
  scores?: unknown[]; // ✅ added
};

const FINISHED_STATES = new Set([
  "FT",
  "AET",
  "PEN",
  "POSTPONED",
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

/**
 * Sync fixtures for next N days into fixtures_live
 * Token is passed in (so index.ts can provide secrets)
 */
export async function syncFixturesWindow(token: string) {
  const db = admin.firestore();

  const start = new Date();
  const end = addDaysUTC(start, ENV.FEATURES.FIXTURE_LOOKAHEAD_DAYS);

  const startStr = formatDateUTC(start);
  const endStr = formatDateUTC(end);

  // ✅ include scores so we can persist goals for FT matches
  const include = "state;participants;odds;league;scores";

  let page = 1;
  let totalPages = 1;

  console.log(`Syncing fixtures between ${startStr} and ${endStr}...`);

  // In-run set to avoid upserting same team repeatedly
  const seenTeams = new Set<number>();

  while (page <= totalPages) {
    const url =
      `${ENV.SPORTSMONKS.BASE_URL}/fixtures/between/${startStr}/${endStr}` +
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
    totalPages = json?.meta?.pagination?.total_pages ?? 1;

    console.log(`Page ${page}/${totalPages}: ${fixtures.length} fixtures`);

    let batch = db.batch();
    let ops = 0;

    for (const f of fixtures) {
      const short = f.state?.short_name ?? undefined;

      const participants = f.participants ?? [];
      const mapped = extractHomeAway(participants);
      if (!mapped) {
        console.warn(
          `Fixture ${f.id} missing home/away participants; skipping`
        );
        continue;
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
          { merge: true }
        );

        ops++;
        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }

      const startingAtISO = new Date(
        f.starting_at_timestamp * 1000
      ).toISOString();

      // ✅ extract goals from scores (if present)
      // note: extractCurrentGoals expects the fixture to include participants + scores
      const goals = extractCurrentGoals({
        participants: f.participants,
        scores: (f as any).scores,
      });

      // Build fixture payload once (used by both live + archive)
      const fixturePayload: any = {
        id: f.id,
        leagueId: f.league_id,
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

        // Window markers (useful for pruning/debug)
        inWindow: true,
        windowStart: startStr,
        windowEnd: endStr,

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // ✅ persist goals whenever we have them (harmless for NS, useful for FT)
      if (goals) {
        fixturePayload.homeGoals = goals.homeGoals;
        fixturePayload.awayGoals = goals.awayGoals;
      }

      const liveRef = db.collection("fixtures_live").doc(String(f.id));

      // Exclude cup competitions
      const ALLOWED_LEAGUE_IDS = new Set<number>([
        8, 9, 72, 82, 181, 208, 244, 271, 301, 384, 387, 444, 453, 462, 501,
        564, 567, 573, 591, 600,
      ]);

      if (!ALLOWED_LEAGUE_IDS.has(f.league_id)) {
        continue;
      }

      // --- ARCHIVING RULE ---
      // If fixture is finished, move to fixtures_archive and remove from fixtures_live.
      // Otherwise, keep in fixtures_live.
      if (isFinished(short)) {
        const archRef = db.collection("fixtures_archive").doc(String(f.id));

        batch.set(
          archRef,
          {
            ...fixturePayload,
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            stateShortName: f.state?.short_name ?? null,
            evaluationDone: false,
          },
          { merge: true }
        );
        batch.delete(liveRef);

        ops += 2; // one set + one delete
      } else {
        // skip NOT 'Not started'
        if (short && short !== "NS") {
          continue;
        }

        batch.set(liveRef, fixturePayload, { merge: true });
        ops++;
      }

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) await batch.commit();
    page++;
  }

  console.log("Fixture sync complete.");
}
