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

export const useHighlightedPredictions = () => {
  const [preds, setPreds] = useState<PredictionDoc[]>([]);
  const [fixturesById, setFixturesById] = useState<Record<string, FixtureDoc>>(
    {},
  );
  const [teamsById, setTeamsById] = useState<Record<string, TeamDoc>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1) subscribe to highlighted predictions
  useEffect(() => {
    setLoading(true);
    setError(null);

    const qPred = query(
      collection(db, 'predictions_live'),
      where('highlighted', '==', true),
      orderBy('highlightScore', 'desc'),
      limit(10), // <= keep it at 10 so we can use documentId() "in" without chunking
    );

    const unsub: Unsubscribe = onSnapshot(
      qPred,
      (snap) => {
        const next = snap.docs.map((d) => d.data() as PredictionDoc);
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

  // 2) fetch fixtures for the current highlighted fixtureIds
  const fixtureIds = useMemo(
    () => preds.map((p) => String(p.fixtureId)),
    [preds],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (fixtureIds.length === 0) {
        setFixturesById({});
        return;
      }

      try {
        // Because we limit preds to 10, we can do a single "in" query.
        const qFix = query(
          collection(db, 'fixtures_live'),
          where(documentId(), 'in', fixtureIds),
        );

        const snap = await getDocs(qFix);
        if (cancelled) return;

        const map: Record<string, FixtureDoc> = {};
        for (const d of snap.docs) {
          map[d.id] = d.data() as FixtureDoc;
        }
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
  }, [fixtureIds.join('|')]); // stable dep

  // 3) fetch teams for the fixtures
  const teamIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(fixturesById).forEach((fx) => {
      ids.add(String(fx.homeTeamId));
      ids.add(String(fx.awayTeamId));
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
        const qTeams = query(
          collection(db, 'teams'),
          where(documentId(), 'in', teamIds),
        );

        const snap = await getDocs(qTeams);
        if (cancelled) return;

        const map: Record<string, TeamDoc> = {};
        for (const d of snap.docs) {
          map[d.id] = d.data() as TeamDoc;
        }
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

  // 4) join
  const items: HighlightItem[] = useMemo(() => {
    return preds
      .map((p) => {
        const fx = fixturesById[String(p.fixtureId)];
        if (!fx) return null;
        return {
          fixtureId: String(p.fixtureId),
          fixture: fx,
          prediction: p,
          homeTeam: teamsById[String(fx.homeTeamId)],
          awayTeam: teamsById[String(fx.awayTeamId)],
        };
      })
      .filter(Boolean) as HighlightItem[];
  }, [preds, fixturesById, teamsById]);
  
  return {
    data: items,
    loading,
    error,
    raw: { preds, fixturesById, teamsById },
  };
};
