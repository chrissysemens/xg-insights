"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.avg = avg;
exports.safeDivide = safeDivide;
function avg(nums) {
    if (!nums.length)
        return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function safeDivide(a, b) {
    return b === 0 ? 0 : a / b;
}
//# sourceMappingURL=math.js.map