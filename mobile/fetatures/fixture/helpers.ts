import { db } from '@/firebase';
import { FixtureDetailsDoc, Pick } from '@/types';
import { getDoc, doc } from 'firebase/firestore';

/**
 * Get fixture details from Firestore
 * @param fixtureId - id of the fixture
 * @returns - FixtureDetailsDoc or null if not found
 */
export const getFixtureDetails = async (fixtureId: string) => {
  const snap = await getDoc(doc(db, 'fixture_details', fixtureId));
  if (!snap.exists()) return null;
  return snap.data() as FixtureDetailsDoc;
};

/**
 * Returns cleaned array of max 5 numbers rounded to 2 decimal places
 * @param arr - Array of numbers
 * @returns - Cleaned array of numbers
 */
export const clean5 = (arr?: number[]) =>
  (arr ?? [])
    .slice(0, 5)
    .map((v) => (Number.isFinite(v) ? Number(v.toFixed(2)) : 0));

/**
 * Returns line data for chart from array of numbers
 * @param arr - Array of numbers
 * @returns -   Array of { x, y } objects for charting
 */
export const toLineData = (arr?: number[]) => {
  const vals = clean5(arr);
  return vals.map((y, i) => ({ x: i + 1, y }));
};

/**
 * Build prediction chips for fixture details
 * @param data - FixtureDetailsDoc
 * @returns - Array of PickChip
 */
export const buildPredictionBadges = (
  data: FixtureDetailsDoc,
): Pick[] => {
  if (!data) {
    return [];
  }
  const p = data.prediction;
  if (!p) return [];

  const chips: Pick[] = [];

  // Always show match winner chip on details
  chips.push({ key: 'mw', label: 'Match winner' });

  // Only show BTTS if pick is Y
  if (p.btts?.pick === 'Y') chips.push({ key: 'btts', label: 'BTTS' });

  // Only show Over 2.5 if pick is Y
  if (p.over25?.pick === 'Y') chips.push({ key: 'o25', label: 'Over 2.5' });

  return chips;
};

/**
 * Rerurns result 'H', 'A' or 'D' from scores
 * @param h - home score
 * @param a - away score
 * @returns - 'H', 'A' or 'D'
 */
export const scoreToResult = (h: number, a: number): 'H' | 'A' | 'D' =>
  h > a ? 'H' : h < a ? 'A' : 'D';
