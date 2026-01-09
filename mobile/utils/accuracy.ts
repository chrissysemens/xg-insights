import { ArchivedFixture, ArchivedFixtureDoc, Metric } from "@/types";

export const accuracy = <T extends string>(
  items: ArchivedFixture[],
  getPred: (f: ArchivedFixture) => T | undefined,
  getActual: (f: ArchivedFixture) => T | undefined
) =>{
  let predicted = 0;
  let correct = 0;

  for (const f of items) {
    const p = getPred(f);
    if (!p) continue;
    predicted += 1;

    const a = getActual(f);
    if (a && a === p) correct += 1;
  }

  return { predicted, correct };
}

export function calcResultAccuracy(docs: ArchivedFixtureDoc[]): Metric {
  let correct = 0;
  let total = 0;

  for (const d of docs) {
    if (!d.evaluationDone) continue;

    const pred = d.evaluation?.predicted?.resultPick;
    const act = d.evaluation?.actual?.result;
    if (!pred || !act) continue;

    total += 1;
    if (pred === act) correct += 1;
  }

  return { correct, total };
}

export function calcSignalAccuracy(
  docs: ArchivedFixtureDoc[],
  kind: 'btts' | 'over25',
): Metric & { flagged: number } {
  let correct = 0;
  let total = 0;
  let flagged = 0;

  for (const d of docs) {
    if (!d.evaluationDone) continue;

    const pred =
      kind === 'btts'
        ? d.evaluation?.predicted?.bttsPick
        : d.evaluation?.predicted?.over25Pick;

    if (pred !== 'Y') continue;
    flagged += 1;

    const act =
      kind === 'btts'
        ? d.evaluation?.actual?.btts
        : d.evaluation?.actual?.over25;

    if (act !== 'Y' && act !== 'N') continue;

    total += 1;
    if (act === 'Y') correct += 1; // ✅ "Y" hit rate
  }

  return { correct, total, flagged };
}

type Datum = { x: number; y: number };

const weekStartMsFromUnixSeconds = (unixSeconds: number) => {
  const d = new Date(unixSeconds * 1000);
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime(); // ms (good for chart x)
};

export function buildWeeklyResultAccuracy(fixtures: ArchivedFixtureDoc[]): Datum[] {
  const buckets = new Map<number, { total: number; correct: number }>();

  for (const f of fixtures) {
    if (!f.evaluationDone) continue;

    const ts = f.startingAtTimestamp;
    if (!ts) continue;

    const pred = f.evaluation?.predicted?.resultPick;
    const act = f.evaluation?.actual?.result;
    if (!pred || !act) continue;

    const x = weekStartMsFromUnixSeconds(ts);
    const b = buckets.get(x) ?? { total: 0, correct: 0 };

    b.total += 1;
    if (pred === act) b.correct += 1;

    buckets.set(x, b);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([x, { total, correct }]) => ({
      x,
      y: total > 0 ? Math.round((correct / total) * 100) : 0,
    }));
}

