import { minScoreForTab } from '@/features/highlights/helpers';
import { db } from '@/firebase';
import { FixtureDoc, HighlightItem, PredictionDoc, TeamDoc } from '@/types';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  documentId,
  getDocs,
  QueryConstraint,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

export type Tab = 'winners' | 'goals' | 'interesting';

type FixtureDetailsDoc = {
  fixtureId: string;
  startingAtTimestamp?: number;

  homeTeamId?: number;
  awayTeamId?: number;

  home?: { id: number; name: string; imagePath?: string | null };
  away?: { id: number; name: string; imagePath?: string | null };
  league?: { id?: number; name?: string };

  form?: {
    homeLast5?: Array<'W' | 'D' | 'L'> | null;
    awayLast5?: Array<'W' | 'D' | 'L'> | null;
  } | null;

  prediction?: PredictionDoc | null;
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const numOr0 = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/**
 * What field do we use as the "score" for sorting/filtering?
 *
 * - winners/goals: highlightScore (as you already have)
 * - interesting: use interestingMeta.valueScore if present (client sort)
 *
 * If you later store `prediction.highlightScore = interestingMeta.valueScore`,
 * you can remove the interesting special-case and treat everything as highlightScore.
 */
const interestingScore = (m: any) => {
  const dHome = numOr0(m?.deltaHome);
  const dDraw = numOr0(m?.deltaDraw);
  const dAway = numOr0(m?.deltaAway);

  return Math.max(Math.abs(dHome), Math.abs(dDraw), Math.abs(dAway));
};

const scoreForTab = (tab: Tab, pred: any) => {
  if (tab === 'interesting') {
    return (
      interestingScore(pred?.interestingMeta) ||
      numOr0(pred?.highlightScore)
    );
  }
  return numOr0(pred?.highlightScore);
};

/**
 * Tab -> Firestore constraint.
 * Use tags so the query returns the right population.
 */
const constraintForTab = (tab: Tab): QueryConstraint => {
  switch (tab) {
    case 'winners':
      return where('prediction.tags.clearFavourite', '==', true);

    case 'goals':
      // includes BOTH HIGH_GOALS and BTTS_LIKELY (and any future goals-ish reason)
      return where('prediction.tags.goals', '==', true);

    case 'interesting':
      return where('prediction.tags.interesting', '==', true);
  }
};

export function useHighlightsForTab(tab: Tab, take = 50) {
  const [fixtureIds, setFixtureIds] = useState<string[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, FixtureDetailsDoc>>(
    {},
  );
  const [fixturesById, setFixturesById] = useState<Record<string, FixtureDoc>>(
    {},
  );
  const [teamsById, setTeamsById] = useState<Record<string, TeamDoc>>({});

  const [detailsLoading, setDetailsLoading] = useState(true);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) subscribe to fixture_details filtered by tab + qualified
  useEffect(() => {
    setDetailsLoading(true);
    setError(null);

    const minScore = minScoreForTab(tab);

    // For winners/goals we can filter+order in Firestore by highlightScore.
    // For interesting we *cannot* (unless you store a numeric field we can query),
    // so we just order by updatedAt / startingAtTimestamp and filter client-side.
    const base: QueryConstraint[] = [
      constraintForTab(tab),
      where('prediction.qualified', '==', true),
      orderBy(documentId(), 'asc'),
      limit(take),
    ];

    const scoreOrdered: QueryConstraint[] =
      tab === 'interesting'
        ? [
            // you could order by starting time to keep it sensible
            orderBy('startingAtTimestamp', 'asc'),
            orderBy(documentId(), 'asc'),
            limit(Math.max(take * 3, take)), // pull more then filter client-side
          ]
        : [
            // winners/goals: enforce minScore + sort high-first
            where('prediction.highlightScore', '>=', minScore),
            orderBy('prediction.highlightScore', 'desc'),
            orderBy(documentId(), 'asc'),
            limit(take),
          ];

    const qRef = query(
      collection(db, 'fixture_details'),
      constraintForTab(tab),
      where('prediction.qualified', '==', true),
      ...scoreOrdered,
    );

    const unsub: Unsubscribe = onSnapshot(
      qRef,
      (snap) => {
        const ids: string[] = [];
        const det: Record<string, FixtureDetailsDoc> = {};

        for (const d of snap.docs) {
          ids.push(d.id);
          det[d.id] = d.data() as FixtureDetailsDoc;
        }

        setFixtureIds(ids);
        setDetailsById(det);
        setDetailsLoading(false);
      },
      (e) => {
        setError(e?.message ?? 'Failed to load fixture_details');
        setDetailsLoading(false);
      },
    );

    return () => unsub();
  }, [tab, take]);

  // 2) fetch fixtures_live for those ids
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (fixtureIds.length === 0) {
        setFixturesById({});
        return;
      }

      setFixturesLoading(true);

      try {
        const chunks = chunk(fixtureIds, 10);
        const map: Record<string, FixtureDoc> = {};

        for (const ids of chunks) {
          const qFix = query(
            collection(db, 'fixtures_live'),
            where(documentId(), 'in', ids),
          );
          const snap = await getDocs(qFix);
          for (const d of snap.docs) map[d.id] = d.data() as FixtureDoc;
        }

        if (!cancelled) setFixturesById(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load fixtures_live');
      } finally {
        if (!cancelled) setFixturesLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fixtureIds.join('|')]);

  // 3) fetch teams
  const teamIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(fixturesById).forEach((fx) => {
      if (fx?.homeTeamId != null) ids.add(String(fx.homeTeamId));
      if (fx?.awayTeamId != null) ids.add(String(fx.awayTeamId));
    });
    return Array.from(ids);
  }, [fixturesById]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (teamIds.length === 0) {
        setTeamsById({});
        return;
      }

      setTeamsLoading(true);

      try {
        const chunks = chunk(teamIds, 10);
        const map: Record<string, TeamDoc> = {};

        for (const ids of chunks) {
          const qTeams = query(
            collection(db, 'teams'),
            where(documentId(), 'in', ids),
          );
          const snap = await getDocs(qTeams);
          for (const d of snap.docs) map[d.id] = d.data() as TeamDoc;
        }

        if (!cancelled) setTeamsById(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load teams');
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [teamIds.join('|')]);

  // 4) build items
 const items: HighlightItem[] = useMemo(() => {
  const out = fixtureIds
    .map((fid) => {
      const fx = fixturesById[fid];
      const det = detailsById[fid];
      const pred = det?.prediction ?? null;
      if (!fx || !pred) return null;

      const score = scoreForTab(tab, pred as any);

      const minScore =
        tab === 'interesting'
          ? Math.max(
              numOr0((pred as any)?.interestingMeta?.threshold) || 0.08,
              0, // safety
            )
          : minScoreForTab(tab);

      if (score < minScore) return null;

      return {
        fixtureId: fid,
        fixture: fx,
        prediction: pred as any,
        homeTeam: teamsById[String(fx.homeTeamId)],
        awayTeam: teamsById[String(fx.awayTeamId)],
        fixtureDetails: det ?? null,
      };
    })
    .filter(Boolean) as HighlightItem[];

  out.sort((a, b) => {
    const diff =
      scoreForTab(tab, b.prediction) - scoreForTab(tab, a.prediction);
    if (diff !== 0) return diff;
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  return out.slice(0, take);
}, [tab, take, fixtureIds, fixturesById, teamsById, detailsById]);

  const loading = detailsLoading || fixturesLoading || teamsLoading;

  return {
    data: items,
    loading,
    error,
    raw: { fixtureIds, fixturesById, teamsById, detailsById },
  };
}
