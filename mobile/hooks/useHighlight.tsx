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

const tagFieldForTab = (tab: Tab) => {
  switch (tab) {
    case 'winners':
      return 'prediction.tags.clearFavourite' as const;
    case 'goals':
      return 'prediction.tags.goals' as const;
    case 'interesting':
      return 'prediction.tags.interesting' as const;
  }
};

const numOr0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function useHighlightsForTab(tab: Tab, take = 50) {
  const [fixtureIds, setFixtureIds] = useState<string[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, FixtureDetailsDoc>>({});
  const [fixturesById, setFixturesById] = useState<Record<string, FixtureDoc>>({});
  const [teamsById, setTeamsById] = useState<Record<string, TeamDoc>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1) subscribe to fixture_details filtered by tab + qualified, sorted by highest highlightScore first
  useEffect(() => {
    setLoading(true);
    setError(null);

    const tagField = tagFieldForTab(tab);

    const qRef = query(
      collection(db, 'fixture_details'),
      where(tagField, '==', true),
      where('prediction.qualified', '==', true),
      // sort highest first
      orderBy('prediction.highlightScore', 'desc'),
      // tie-break (optional but helps deterministic ordering + some index setups)
      orderBy(documentId(), 'asc'),
      limit(take),
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
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? 'Failed to load fixture_details');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tab, take]);

  // 2) fetch fixtures_live for those ids (needed if FixtureCard depends on FixtureDoc fields)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (fixtureIds.length === 0) {
        setFixturesById({});
        return;
      }

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
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fixtureIds.join('|')]);

  // 3) fetch teams for those fixtures
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
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [teamIds.join('|')]);

  // 4) build items, and ensure highest-first even if Firestore returns ties / missing scores
  const items: HighlightItem[] = useMemo(() => {
    const out = fixtureIds
      .map((fid) => {
        const fx = fixturesById[fid];
        const det = detailsById[fid];
        const pred = det?.prediction ?? null;

        if (!fx || !pred) return null;

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

    out.sort(
      (a, b) =>
        numOr0((b.prediction as any)?.highlightScore) -
        numOr0((a.prediction as any)?.highlightScore),
    );

    return out;
  }, [fixtureIds, fixturesById, teamsById, detailsById]);

  return {
    data: items,
    loading,
    error,
    raw: { fixtureIds, fixturesById, teamsById, detailsById },
  };
}
