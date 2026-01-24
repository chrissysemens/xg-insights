import { FixtureDetailsDoc, Scoreline } from '@/types';

/**
 * Returns factorial of n
 * @param n - number
 * @returns - factorial of n
 */
export const factorial = (n: number): number => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

/**
 * Calculates Poisson probability
 * @param k - number of events
 * @param lambda - expected number of events
 * @returns - probability of k events
 */
export const poissonP = (k: number, lambda: number) =>
  (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);

/**
 * Clamp value between min and max
 * @param v - value
 * @param min - minimum
 * @param max - maximum
 * @returns - clamped value
 */
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Calculates top scorelines based on Poisson distribution
 * @param lambdaH - lambda for home team
 * @param lambdaA - lambda for away team
 * @param maxGoals - maximum goals to consider
 * @param top - number of top scorelines to return
 * @returns - array of top scorelines with probabilities
 */
export const topScorelines = (
  lambdaH: number,
  lambdaA: number,
  maxGoals = 5,
  top = 5,
) => {
  const scores: Scoreline[] = [];
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      scores.push({ h, a, p: poissonP(h, lambdaH) * poissonP(a, lambdaA) });
    }
  }
  return scores.sort((x, y) => y.p - x.p).slice(0, top);
};

/**
 * Computes lambda values for home and away teams based on fixture details
 * @param d - FixtureDetailsDoc
 * @returns - object with home and away lambda values or null
 */
export const computeLambdas = (d: FixtureDetailsDoc) => {
  const xg = d.xg;
  if (!xg) return null;

  const lambdaHome = (xg.homeLast5ForAvg + xg.awayLast5AgainstAvg) / 2;
  const lambdaAway = (xg.awayLast5ForAvg + xg.homeLast5AgainstAvg) / 2;

  return {
    home: clamp(lambdaHome * 1.05, 0.1, 6),
    away: clamp(lambdaAway, 0.1, 6),
  };
};
