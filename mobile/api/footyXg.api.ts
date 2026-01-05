const BASE_URL = 'https://football-xg-statistics.p.rapidapi.com';

const RAPID_API_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;

if (!RAPID_API_KEY) {
  console.warn('⚠️ Missing EXPO_PUBLIC_RAPIDAPI_KEY');
}

// Types
export type Country = {
  id: number;
  name: string;
};

export type Tournament = {
  id: number;
  name: string;
};

export type Season = {
  id: number;
  name: string;
};

export type TeamRef = {
  id: number;
  name: string;
};

export type Fixture = {
  id: number;
  status: string;
  startTime: number;

  homeTeam: TeamRef;
  awayTeam: TeamRef;

  homeScore?: {
    final?: number;
    firstHalf?: number;
  };

  awayScore?: {
    final?: number;
    firstHalf?: number;
  };

  xg?: {
    home?: number;
    away?: number;
  };

  odds?: Array<{
    type: string;
    open?: number;
    last?: number;
  }>;
};

export type FixturesParams = {
  from?: number;
  to?: number;
  filter?: string;
};

type ApiResponse<T> = {
  result: T;
};

// -----------------------------
// Internal fetch helper
// -----------------------------
const request = async <T>(path: string): Promise<ApiResponse<T>> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPID_API_KEY ?? '',
      'x-rapidapi-host': 'football-xg-statistics.p.rapidapi.com',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Football xG API ${res.status}: ${text}`);
  }

  return res.json();
};

// -----------------------------
// API surface
// -----------------------------
export const api = {
  getCountries(): Promise<ApiResponse<Country[]>> {
    return request('/countries/');
  },

  getTournaments(countryId: number): Promise<ApiResponse<Tournament[]>> {
    return request(`/countries/${countryId}/tournaments/`);
  },

  getSeasons(tournamentId: number): Promise<ApiResponse<Season[]>> {
    return request(`/tournaments/${tournamentId}/seasons/`);
  },

  getFixtures(
    seasonId: number,
    params?: FixturesParams,
  ): Promise<ApiResponse<Fixture[]>> {
    const sp = new URLSearchParams();

    // Use != null so 0 doesn't get dropped
    if (params?.from != null) sp.set('from', String(params.from));
    if (params?.to != null) sp.set('to', String(params.to));
    if (params?.filter) sp.set('filter', params.filter);

    const qs = sp.toString();
    const path = `/seasons/${seasonId}/fixtures/${qs ? `?${qs}` : ''}`;

    return request(path);
  },
};
