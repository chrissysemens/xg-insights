import { useQuery } from '@tanstack/react-query';
import { predict, PredictRequest } from '../api/prediction.api';

export const usePrediction = (req?: PredictRequest) => {
  return useQuery({
    queryKey: req
      ? ['prediction', req.seasonId, req.homeTeamId, req.awayTeamId]
      : ['prediction', 'none'],
    queryFn: () => predict(req!),
    enabled: !!req,
    staleTime: 1000 * 30,
  });
};
