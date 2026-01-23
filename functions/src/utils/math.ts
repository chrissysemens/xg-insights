/**
 * Calculates the average of an array of numbers.
 * @param nums - number[]
 * @returns - average or null if array is empty
 */
export function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Converts decimal odds to implied probability.
 * @param d - decimal odds number or null
 * @returns - number | null
 */
export const impliedFromDecimal = (d: number | null) => {
  return d && d > 0 ? 1 / d : null;
}


/**
 * Rerturns a number if the input can be converted to a finite number, otherwise returns null.
 * @param v - unknown
 * @returns - number | null
 */
export const numOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Returns the result of dividing a by b, or 0 if b is zero.
 * @param a - number
 * @param b - number
 * @returns - Division result or 0 if divisor is zero
 */
export function safeDivide(a: number, b: number) {
  return b === 0 ? 0 : a / b;
}

/**
 * Converts input to a decimal odds number if valid, otherwise returns null.
 * @param n  - unknown
 * @returns - number | null
 */
export const toDecimal = (n: unknown): number | null => {
  const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(v) && v > 1.0 ? v : null;
}