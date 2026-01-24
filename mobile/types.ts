export type TeamDoc = {
  id: string;
  name: string;
  shortCode?: string | null;
  imagePath?: string | null;
};

export type Yn = 'Y' | 'N';

export type YnPick = { Y: number; N: number; pick: Yn };

export type Pick = { key: string; label: string };

export type Scoreline = { h: number; a: number; p: number };

export type PredictionDoc = {
  fixtureId: string;
  goalsPick: GoalsPick;
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

export type GoalsPick = {
  kind: 'btts' | 'over25';
  pick: 'Y';
  prob: number;
} | null;

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
      result?: Result;
      btts?: Yn;
      over25?: Yn;
    };
    correct?: {
      result?: boolean;
      btts?: boolean;
      over25?: boolean;
    };
  };
};

export type Evaluation = {
  predicted?: {
    resultPick?: Result;
    bttsPick?: Yn;
    over25Pick?: Yn;
  };
  actual?: {
    result?: Result;
    btts?: Yn;
    over25?: Yn;
  };
};

export type ArchivedFixtureDoc = {
  evaluationDone?: boolean;
  startingAtTimestamp?: number;
  evaluation?: Evaluation;
};

export type Form = {
  homeLast5?: Result[] | null;
  awayLast5?: Result[] | null;
};

export type Result = 'W' | 'D' | 'L';
export type Outcome = 'H' | 'D' | 'A';

export type Team = { id: number; name: string; imagePath?: string | null };

export type League = { id: number; name: string };

export type H2H = {
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  startingAtTimestamp: number;
};

export type Xg = {
  awayLast5Against: number[];
  awayLast5AgainstAvg: number;
  awayLast5For: number[];
  awayLast5ForAvg: number;
  homeLast5Against: number[];
  homeLast5AgainstAvg: number;
  homeLast5For: number[];
  homeLast5ForAvg: number;
};

export type MatchResult = {
  H: number;
  D: number;
  A: number;
  pick: Outcome;
};

export type Over25 = { Y: number; N: number; pick: Yn };

export type BTTS = { Y: number; N: number; pick: Yn};

export type Prediction = {
  matchResult: MatchResult | null;
  over25?: Over25 | null;
  btts?: BTTS | null;
  highlightReason: HighlightReason | null;
  highlightScore: number;
  highlighted: boolean;
};

export type FixtureDetailsDoc = {
  fixtureId: string;
  startingAtTimestamp?: number;
  league: League | null;
  home: Team;
  away: Team;
  form?: Form | null;
  h2h?: H2H[] | null;
  prediction: Prediction | null;
  xg: Xg | null;
};
export type Metric = { correct: number; total: number };

export type Datum = { x: number; y: number };
