import { PredictionDoc } from "@/types";

export const getGoalsScore = (p: PredictionDoc | null | undefined) => {
  const gp = p?.goalsPick;
  return gp?.pick === 'Y' ? gp.prob : null;
};

export const getResultConf = (p: any) =>
  Math.max(
    p?.matchResult?.H ?? 0,
    p?.matchResult?.D ?? 0,
    p?.matchResult?.A ?? 0,
  );
