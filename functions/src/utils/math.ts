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
 * Returns the result of dividing a by b, or 0 if b is zero.
 * @param a - number
 * @param b - number
 * @returns - Division result or 0 if divisor is zero
 */
export function safeDivide(a: number, b: number) {
  return b === 0 ? 0 : a / b;
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
