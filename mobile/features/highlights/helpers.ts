import { Tab } from "@/hooks/useHighlight";
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


 export const minScoreForTab = (tab: Tab) => {
    switch (tab) {
      case 'winners':
        return 0.70;
      case 'goals':
        return 0.60;
      case 'interesting':
        return 0.55;
    }
};