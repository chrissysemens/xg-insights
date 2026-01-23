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

function toDecimal(n: unknown): number | null {
  const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(v) && v > 1.0 ? v : null;
}

function impliedFromDecimal(d: number | null) {
  return d && d > 0 ? 1 / d : null;
}

/**
 * Very defensive first pass:
 * extracts best-available decimal odds for 1 / X / 2 outcomes.
 * Once you paste a real odds object, we can tighten this to SportsMonks exact shape.
 */
export const  normalise1x2Odds = (
  odds: unknown[] | undefined | null,
): OddsSnapshot | null => {
  if (!Array.isArray(odds) || odds.length === 0) return null;

  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;

  for (const o of odds) {
    const obj: any = o;

    const label = String(
      obj?.label ??
        obj?.name ??
        obj?.market_description ??
        obj?.type ??
        obj?.outcome ??
        "",
    )
      .toLowerCase()
      .trim();

    const value =
      toDecimal(obj?.value) ??
      toDecimal(obj?.odd) ??
      toDecimal(obj?.odds) ??
      null;

    if (!value) continue;

    if (label === "1" || label.includes("home")) home = Math.max(home ?? 0, value);
    else if (label === "x" || label.includes("draw")) draw = Math.max(draw ?? 0, value);
    else if (label === "2" || label.includes("away")) away = Math.max(away ?? 0, value);
  }

  if (home == null && draw == null && away == null) return null;

  return {
    market: "1x2",
    decimal: { home, draw, away },
    implied: {
      home: impliedFromDecimal(home),
      draw: impliedFromDecimal(draw),
      away: impliedFromDecimal(away),
    },
  };
}
