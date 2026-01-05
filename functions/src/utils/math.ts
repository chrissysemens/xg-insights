export function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function safeDivide(a: number, b: number) {
  return b === 0 ? 0 : a / b;
}