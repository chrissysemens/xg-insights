import { useQuery } from '@tanstack/react-query';
import { api, FixturesParams } from '../api/footyXg.api';



// Query keys
export const footballXgKeys = {
  countries: ['footballXg', 'countries'] as const,
  tournaments: (countryId: number) =>
    ['footballXg', 'tournaments', countryId] as const,
  seasons: (tournamentId: number) =>
    ['footballXg', 'seasons', tournamentId] as const,
  fixtures: (seasonId: number, params?: FixturesParams) =>
      [
        'footballXg',
        'fixtures',
        seasonId,
        params?.from ?? null,
        params?.to ?? null,
        params?.filter ?? null,
      ] as const,
};

export const useCountries = () => {
  return useQuery({
    queryKey: footballXgKeys.countries,
    queryFn: async () => (await api.getCountries()).result,
  });
};

export const useTournaments = (countryId?: number) => {
  return useQuery({
    queryKey: countryId
      ? footballXgKeys.tournaments(countryId)
      : ['footballXg', 'tournaments', 'none'],
    queryFn: async () => (await api.getTournaments(countryId!)).result,
    enabled: !!countryId,
  });
};

export const useSeasons = (tournamentId?: number) => {
  return useQuery({
    queryKey: tournamentId
      ? footballXgKeys.seasons(tournamentId)
      : ['footballXg', 'seasons', 'none'],
    queryFn: async () => (await api.getSeasons(tournamentId!)).result,
    enabled: !!tournamentId,
  });
};

export const useFixtures = (seasonId?: number, params?: FixturesParams) => {
  console.log('useFixtures called with seasonId:', seasonId, 'params:', params);
  return useQuery({
    queryKey: seasonId
      ? footballXgKeys.fixtures(seasonId, params ?? {})
      : ['footballXg', 'fixtures', 'none'],
    queryFn: async () => (await api.getFixtures(seasonId!, params)).result,
    enabled: !!seasonId,
    staleTime: 1000 * 60 * 30,
    select: (fixtures) => {
      const nowSec = Math.floor(Date.now() / 1000);
      return fixtures.filter((f) => f.startTime >= nowSec && f.status !== 'finished');
    },
  });
};