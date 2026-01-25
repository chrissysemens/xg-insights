export type FetchJSONOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayBaseMs?: number;
};

export type Fixture = {
  id: number;
  league_id: number;
  season_id: number;
  stage_id?: number | null;
  round_id?: number | null;
  state_id: number;
  venue_id?: number | null;
  name: string;
  starting_at: string;
  starting_at_timestamp: number;
  has_odds: boolean;
  has_premium_odds: boolean;
  state?: { id: number; short_name?: string; name?: string; state?: string };
  participants?: Participant[];
  odds?: SportMonksOdd[];
  scores?: unknown[];
  league?: {
    id?: number;
    name?: string;
    short_code?: string | null;
    short_code_2?: string | null;
  };
};

export type RawPagination = {
  has_more?: boolean;
  current_page?: number;
  last_page?: number;
  total_pages?: number;
  [k: string]: unknown;
};

export type SportMonksOdd = {
  market_id: number;
  bookmaker_id: number;
  label: string; // "Home" | "Draw" | "Away" etc
  value: string | number | null;
  stopped?: boolean;
  latest_bookmaker_update?: string | null;
};

export type Market1x2 = {
  market: "1x2";
  decimal: Odds1x2Triple;
  implied: Odds1x2Triple;
  bookmakerId: number;
  updatedAt?: string | null;
};

export type FormLetter = "W" | "D" | "L";

export type Goals = { homeGoals: number; awayGoals: number };

export enum HighlightReason {
  HIGH_GOALS = "HIGH_GOALS",
  BTTS_LIKELY = "BTTS_LIKELY",
  CLEAR_FAVOURITE = "CLEAR_FAVOURITE",
}

export type Location = "home" | "away";

export type Odds1x2Triple = { home: number; draw: number; away: number };

export type MarketProbs1x2 = {
  home: number;
  draw: number;
  away: number;
  overround: number; // sum of raw implieds
};

export type Odds1X2 = {
  home: number | null;
  draw: number | null;
  away: number | null;
};

export type OddsSnapshot = {
  market: "1x2";
  decimal: Odds1X2;
  implied: { home: number | null; draw: number | null; away: number | null };
};

export type Pagination = {
  has_more?: boolean;
  current_page?: number;
  next_page?: number;
  total_pages?: number;
};

export type Participant = {
  id: number;
  name: string;
  short_code?: string | null;
  image_path?: string | null;
  country_id?: number | null;
  founded?: number | null;
  last_played_at?: string | null;
  meta?: { location?: Location; position?: number | null };
};

export type Pick = "Y" | "N";

export type PredictBatchRequest = {
  modelVersion: string;
  items: Array<{ fixtureId: string; features: any }>;
};

export type PredictBatchResponse = {
  modelVersion: string;
  predictions: Array<{
    fixtureId: string;
    matchResult: { H: number; D: number; A: number; pick: ResultPick };
    over25?: { Y: number; N: number; pick: Pick };
    btts?: { Y: number; N: number; pick: Pick };
  }>;
};

export type ResultPick = "H" | "D" | "A";
