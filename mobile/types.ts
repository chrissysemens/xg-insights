export type TeamDoc = {
  id: string;
  name: string;
  shortCode?: string | null;
  imagePath?: string | null;
};

export type MatchResult = {
  H: number;
  D: number;
  A: number;
  pick: 'H' | 'D' | 'A';
};
export type YnPick = { Y: number; N: number; pick: 'Y' | 'N' };

export type PredictionDoc = {
  fixtureId: string;
  modelVersion: string;
  matchResult: MatchResult;
  over25: YnPick | null;
  btts: YnPick | null;
  highlighted: boolean;
  highlightScore?: number;
  highlightReason?: HighlightReason;
  generatedAt?: any;
};

export type FixtureDoc = {
  id: string;
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
  xgAvailable?: boolean;
  state?: { shortName?: string };
};

export type HighlightItem = {
  fixtureId: string;
  fixture: FixtureDoc;
  prediction: PredictionDoc;
  homeTeam: TeamDoc | undefined;
  awayTeam: TeamDoc | undefined;
};

export enum HighlightReason {
  CLEAR_FAVOURITE = 'CLEAR_FAVOURITE',
  HIGH_GOALS = 'HIGH_GOALS',
  BTTS_LIKELY = 'BTTS_LIKELY',
}

export type ArchivedFixture = {
  evaluation?: {
    actual?: {
      result?: 'H' | 'D' | 'A';
      btts?: 'Y' | 'N';
      over25?: 'Y' | 'N';
    };
    correct?: {
      result?: boolean;
      btts?: boolean;
      over25?: boolean;
    };
  };
};

export type ArchivedFixtureDoc = {
  evaluationDone?: boolean;
  startingAtTimestamp?: number;
  evaluation?: {
    predicted?: {
      resultPick?: 'H' | 'D' | 'A';
      bttsPick?: 'Y' | 'N';
      over25Pick?: 'Y' | 'N';
    };
    actual?: {
      result?: 'H' | 'D' | 'A';
      btts?: 'Y' | 'N';
      over25?: 'Y' | 'N';
    };
  };
};

export type FormLetter = 'W' | 'D' | 'L';

export type FixtureDetailsDoc = {
  fixtureId: string;
  startingAtTimestamp?: number;
  league?: { id: number; name: string } | null;
  home: { id: number; name: string; imagePath?: string | null };
  away: { id: number; name: string; imagePath?: string | null };
  form?: {
    homeLast5?: FormLetter[] | null;
    awayLast5?: FormLetter[] | null;
  } | null;
  h2h?: Array<{
    homeName: string;
    awayName: string;
    homeGoals: number;
    awayGoals: number;
    startingAtTimestamp: number;
  }> | null;
  prediction?: {
    matchResult: { H: number; D: number; A: number; pick: 'H' | 'D' | 'A' };
    over25?: { Y: number; N: number; pick: 'Y' | 'N' } | null;
    btts?: { Y: number; N: number; pick: 'Y' | 'N' } | null;
    highlightReason: 'HIGH_GOALS' | 'BTTS_LIKELY' | 'CLEAR_FAVOURITE';
    highlightScore: number;
    highlighted: boolean;
  } | null;
  xg: {
    awayLast5Against: number[],
    awayLast5AgainstAvg: number, 
    awayLast5For: number[],
    awayLast5ForAvg: number,
    homeLast5Against: number[],
    homeLast5AgainstAvg: number, 
    homeLast5For: number[],
    homeLast5ForAvg: number
  } | null;
};
export type Metric = { correct: number; total: number };

export type Datum = { x: number; y: number };
