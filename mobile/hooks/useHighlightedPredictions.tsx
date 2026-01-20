import { db } from '@/firebase';
import { FixtureDoc, HighlightItem, PredictionDoc, TeamDoc } from '@/types';
import {
  query,
  collection,
  where,
  orderBy,
  limit,
  Unsubscribe,
  onSnapshot,
  documentId,
  getDocs,
} from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';

type FixtureDetailsDoc = {
  fixtureId: string;
  homeTeamId: number;
  awayTeamId: number;
  form?: {
    homeLast5?: Array<'W' | 'D' | 'L'> | null;
    awayLast5?: Array<'W' | 'D' | 'L'> | null;
  } | null;
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const useHighlightedPredictions = () => {
  const [preds, setPreds] = useState<Array<PredictionDoc & { _id: string }>>(
    [],
  );
  const [fixturesById, setFixturesById] = useState<Record<string, FixtureDoc>>(
    {},
  );
  const [teamsById, setTeamsById] = useState<Record<string, TeamDoc>>({});
  const [detailsById, setDetailsById] = useState<
    Record<string, FixtureDetailsDoc>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const qPred = query(
      collection(db, 'predictions_live'),
      where('highlighted', '==', true),
      orderBy('highlightScore', 'desc'),
      limit(10),
    );

    const unsub: Unsubscribe = onSnapshot(
      qPred,
      (snap) => {
        const next = snap.docs.map((d) => ({
          _id: d.id,
          ...(d.data() as PredictionDoc),
        }));
        setPreds(next);
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? 'Failed to load highlighted predictions');
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const fixtureIds = useMemo(() => {
    return preds.map((p) => String(p.fixtureId ?? p._id));
  }, [preds]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (fixtureIds.length === 0) {
        setFixturesById({});
        return;
      }

      try {
        const qFix = query(
          collection(db, 'fixtures_live'),
          where(documentId(), 'in', fixtureIds),
        );

        const snap = await getDocs(qFix);
        if (cancelled) return;

        const map: Record<string, FixtureDoc> = {};
        for (const d of snap.docs) map[d.id] = d.data() as FixtureDoc;
        setFixturesById(map);
      } catch (e: any) {
        if (!cancelled)
          setError(e?.message ?? 'Failed to load fixtures for highlights');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fixtureIds.join('|')]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (fixtureIds.length === 0) {
        setDetailsById({});
        return;
      }

      try {
        const chunks = chunk(fixtureIds, 10);
        const allDocs: Array<{ id: string; data: FixtureDetailsDoc }> = [];

        for (const ids of chunks) {
          const qDet = query(
            collection(db, 'fixture_details'),
            where(documentId(), 'in', ids),
          );
          const snap = await getDocs(qDet);
          for (const d of snap.docs) {
            allDocs.push({ id: d.id, data: d.data() as FixtureDetailsDoc });
          }
        }

        if (cancelled) return;

        const map: Record<string, FixtureDetailsDoc> = {};
        for (const x of allDocs) map[x.id] = x.data;
        setDetailsById(map);
      } catch (e: any) {
        console.warn('Failed to load fixture_details', e?.message ?? e);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fixtureIds.join('|')]);

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
        const all: Array<{ id: string; data: TeamDoc }> = [];

        for (const ids of chunks) {
          const qTeams = query(
            collection(db, 'teams'),
            where(documentId(), 'in', ids),
          );
          const snap = await getDocs(qTeams);
          for (const d of snap.docs)
            all.push({ id: d.id, data: d.data() as TeamDoc });
        }

        if (cancelled) return;

        const map: Record<string, TeamDoc> = {};
        for (const x of all) map[x.id] = x.data;
        setTeamsById(map);
      } catch (e: any) {
        if (!cancelled)
          setError(e?.message ?? 'Failed to load teams for highlights');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [teamIds.join('|')]);

  const items: HighlightItem[] = useMemo(() => {
    return preds
      .map((p) => {
        const fid = String(p.fixtureId ?? p._id);
        const fx = fixturesById[fid];
        if (!fx) return null;

        return {
          fixtureId: fid,
          fixture: fx,
          prediction: p,
          homeTeam: teamsById[String(fx.homeTeamId)],
          awayTeam: teamsById[String(fx.awayTeamId)],
          fixtureDetails: detailsById[fid] ?? null,
        };
      })
      .filter(Boolean) as HighlightItem[];
  }, [preds, fixturesById, teamsById, detailsById]);

  return {
    data: items,
    loading,
    error,
    raw: { preds, fixturesById, teamsById, detailsById },
  };
};
