type Goals = { homeGoals: number; awayGoals: number };

function pickScoreRows(scores: any[]): any[] {
  const byDesc = (d: string) =>
    scores.filter((s) => String(s?.description ?? "").toUpperCase() === d);

  const current = byDesc("CURRENT");
  if (current.length) return current;

  const ft = byDesc("FT");
  if (ft.length) return ft;

  return [];
}

export function extractCurrentGoals(fx: any): Goals | null {
  const parts: any[] = fx?.participants ?? [];
  const home = parts.find((p) => p?.meta?.location === "home");
  const away = parts.find((p) => p?.meta?.location === "away");
  if (!home?.id || !away?.id) return null;

  const homeId = Number(home.id);
  const awayId = Number(away.id);

  const scores: any[] = fx?.scores ?? [];
  if (!Array.isArray(scores) || scores.length === 0) return null;

  const rows = pickScoreRows(scores);
  if (rows.length === 0) return null;

  let homeGoals: number | null = null;
  let awayGoals: number | null = null;

  for (const s of rows) {
    const pidRaw = s?.participant_id;
    const goalsRaw = s?.score?.goals;

    if (pidRaw == null || goalsRaw == null) continue;

    const pid = Number(pidRaw);
    const goals = Number(goalsRaw);

    if (pid === homeId) homeGoals = goals;
    if (pid === awayId) awayGoals = goals;
  }

  if (homeGoals == null || awayGoals == null) return null;
  return { homeGoals, awayGoals };
}
