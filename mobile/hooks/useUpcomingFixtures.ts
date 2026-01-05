import { limit, orderBy, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { useFirebase } from './useFirebase';

export type FixtureDoc = {
  id: number;
  startingAtTimestamp: number;
  startingAt: string;
  homeTeamId: number;
  awayTeamId: number;
  seasonId: number;
  name: string;
  leagueId: number;
  stateId: number;
  hasOdds: boolean;
  oddsAvailable: boolean;
  xgAvailable: boolean;
};

export const useUpcomingFixtures = () => {
  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));
  const now = hourBucket * 60 * 60;
  const in7Days = now + 7 * 24 * 60 * 60;

  const constraints = useMemo(
    () => [
      where('startingAtTimestamp', '>=', now),
      where('startingAtTimestamp', '<=', in7Days),
      orderBy('startingAtTimestamp', 'asc'),
      limit(200),
    ],
    [now, in7Days],
  );

  const constraintsKey = `upcoming7days:${hourBucket}`;

  return useFirebase<FixtureDoc>({
    collectionName: 'fixtures_live',
    constraints,
    constraintsKey,
  });
};
