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
  odds?: unknown[];
  scores?: unknown[];
  league?: {
    id?: number;
    name?: string;
    short_code?: string | null;
    short_code_2?: string | null;
  };
};

export enum HighlightReason {
  HIGH_GOALS = "HIGH_GOALS",
  BTTS_LIKELY = "BTTS_LIKELY",
  CLEAR_FAVOURITE = "CLEAR_FAVOURITE",
}

export type Location = "home" | "away";

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
