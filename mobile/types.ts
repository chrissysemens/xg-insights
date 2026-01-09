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

export type Metric = { correct: number; total: number };

export type Datum = { x: number; y: number };
