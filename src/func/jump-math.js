// ─── jump-math.js — pure capital / jump-freighter range & fuel math ─────────────
// No DOM, no globals: unit-testable under Node (`node --test`) and reused in the
// browser via window.JumpMath. Loaded as a plain <script> before jump-planner.js.
//
// EVE mechanics (verified against the SDE / Dotlan):
//   • Jump Drive Calibration   → +20% max jump range per level.
//   • Jump Fuel Conservation   → −10% fuel per level (every jump-capable ship).
//   • Jump Freighters skill    → −10% fuel per level (jump freighters only).
//   • Base fuel = isotopes/LY (SDE dogma attr 868): caps 3000, blops 700,
//     rorqual 4000, jump freighter 10000.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;     // Node / tests
  if (typeof window !== 'undefined') window.JumpMath = api;                       // renderer
  else if (typeof globalThis !== 'undefined') globalThis.JumpMath = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Max jump range (LY). JDC adds +20% of the base per level.
  function jumpRange(baseRangeLy, jdcLevel) {
    return (baseRangeLy || 0) * (1 + 0.20 * (jdcLevel || 0));
  }

  // Effective isotopes per light-year after skills.
  function jumpFuelPerLy(baseFuel, jfcLevel, jfSkillLevel, isJumpFreighter) {
    const jfcMul = 1 - 0.10 * (jfcLevel || 0);
    const jfMul  = isJumpFreighter ? (1 - 0.10 * (jfSkillLevel || 0)) : 1;
    return (baseFuel || 0) * jfcMul * jfMul;
  }

  // Total isotopes for one jump of `distanceLy`, rounded up (never under-fuel).
  function jumpHopFuel(distanceLy, baseFuel, jfcLevel, jfSkillLevel, isJumpFreighter) {
    return Math.ceil((distanceLy || 0) * jumpFuelPerLy(baseFuel, jfcLevel, jfSkillLevel, isJumpFreighter));
  }

  return { jumpRange, jumpFuelPerLy, jumpHopFuel };
});
