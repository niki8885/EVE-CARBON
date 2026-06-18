// Unit tests for the jump planner's range/fuel math.
// Numbers cross-checked against Dotlan (the canonical reference).
// Run with: node --test   (or npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const JM = require('../src/func/jump-math.js');

const approx = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('jumpRange: +20% of base per JDC level', () => {
  approx(JM.jumpRange(5.0, 5), 10.0);   // Rhea @ JDC5 → 10 ly (matches Dotlan)
  approx(JM.jumpRange(5.0, 0), 5.0);
  approx(JM.jumpRange(3.5, 5), 7.0);    // carrier/dread base 3.5 → 7 ly
  approx(JM.jumpRange(4.0, 5), 8.0);    // black ops base 4.0 → 8 ly
});

test('jumpFuelPerLy: JFC for all ships, Jump Freighters skill for JF only', () => {
  // Rhea (10000 base) at JFC5 + JF5 → 2500/LY (Dotlan: 24,502 over 9.801 ly)
  approx(JM.jumpFuelPerLy(10000, 5, 5, true), 2500);
  approx(JM.jumpFuelPerLy(10000, 5, 0, true), 5000);   // JF skill untrained
  approx(JM.jumpFuelPerLy(10000, 0, 0, true), 10000);  // no skills = base
  // Capitals get only JFC; the JF-skill argument must be ignored when not a JF.
  approx(JM.jumpFuelPerLy(3000, 5, 0, false), 1500);
  approx(JM.jumpFuelPerLy(3000, 5, 5, false), 1500);   // jf level ignored for non-JF
  approx(JM.jumpFuelPerLy(700,  5, 0, false), 350);    // black ops
});

test('jumpHopFuel: distance × per-LY, rounded up', () => {
  assert.equal(JM.jumpHopFuel(10, 10000, 5, 5, true), 25000);   // clean
  assert.equal(JM.jumpHopFuel(9.801, 10000, 5, 5, true), 24503); // ceil(24502.5) — Dotlan shows 24,502 (floors)
  assert.equal(JM.jumpHopFuel(5, 3000, 5, 0, false), 7500);     // carrier 5 ly
  assert.equal(JM.jumpHopFuel(0, 10000, 5, 5, true), 0);
});
