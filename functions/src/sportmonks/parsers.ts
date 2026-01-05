export function getFinalScore(scores: any[]) {
  const home = scores.find(s => s.description === "CURRENT" && s.score.participant === "home")?.score.goals;
  const away = scores.find(s => s.description === "CURRENT" && s.score.participant === "away")?.score.goals;
  if (typeof home !== "number" || typeof away !== "number") return null;
  return { home, away };
}

export function extractTeamIds(fixture: any) {
  const homeTeamId = fixture.participants?.find((p: any) => p.meta?.location === "home")?.id;
  const awayTeamId = fixture.participants?.find((p: any) => p.meta?.location === "away")?.id;
  return { homeTeamId, awayTeamId };
}