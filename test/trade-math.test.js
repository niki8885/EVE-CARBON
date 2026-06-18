// Unit tests for the market-fee math used by the Ore/Ice/Gas/Moon calculators.
// Run with: node --test   (or npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const TM = require('../src/func/trade-math.js');

const approx = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('salesTax: base at level 0, −11%/level, floored at 0', () => {
  approx(TM.salesTax(0), 0.08);
  approx(TM.salesTax(5), 0.08 * 0.45);   // 0.036 at Accounting V
  approx(TM.salesTax(3), 0.08 * (1 - 0.33));
  assert.ok(TM.salesTax(10) >= 0);       // never negative
  approx(TM.salesTax(5, 0.05), 0.05 * 0.45); // custom base
});

test('brokerFee: base 3%, reduced by skill + standings, floored at 0', () => {
  approx(TM.brokerFee(0, 0, 0), 0.03);
  approx(TM.brokerFee(5, 0, 0), 0.03 - 0.015);                 // Broker Relations V → 1.5%
  approx(TM.brokerFee(5, 10, 10), 0.03 - 0.015 - 0.003 - 0.002); // = 0.01
  assert.equal(TM.brokerFee(5, 1000, 1000), 0);               // floored, not negative
});

test('netFactor: buy excludes broker fee; sell/split include it', () => {
  approx(TM.netFactor('buy',   0.036, 0.015), 1 - 0.036);
  approx(TM.netFactor('sell',  0.036, 0.015), 1 - 0.036 - 0.015);
  approx(TM.netFactor('split', 0.036, 0.015), 1 - 0.036 - 0.015);
});

test('pickPrice: chooses sell/buy/split with sensible fallbacks', () => {
  const p = { buy: 100, sell: 120 };
  assert.equal(TM.pickPrice(p, 'sell'), 120);
  assert.equal(TM.pickPrice(p, 'buy'), 100);
  assert.equal(TM.pickPrice(p, 'split'), 110);
  assert.equal(TM.pickPrice({ buy: 0, sell: 120 }, 'buy'), 120);   // no buy order → fall back to sell
  assert.equal(TM.pickPrice({ buy: 100, sell: 0 }, 'split'), 100); // one-sided → that side
  assert.equal(TM.pickPrice(null, 'sell'), 0);
  assert.equal(TM.pickPrice(undefined, 'split'), 0);
});

test('reprocessUnitValue: floors yield per batch, applies price + fees', () => {
  // 65 material / 100 ore units, perfect refine (1.0), price 1000, no fees
  approx(TM.reprocessUnitValue(65, 1000, 1.0, 100, 1), 650);          // 65*1000/100
  // 72.36% refine → floor(65*0.7236)=floor(47.034)=47 → 47*1000/100 = 470
  approx(TM.reprocessUnitValue(65, 1000, 0.7236, 100, 1), 470);
  // net factor applied
  approx(TM.reprocessUnitValue(40, 500, 1.0, 100, 0.949), 40 * 500 / 100 * 0.949);
  assert.equal(TM.reprocessUnitValue(65, 1000, 1.0, 0, 1), 0);        // guards batchSize 0
  assert.equal(TM.reprocessUnitValue(65, 0, 1.0, 100, 1), 0);        // no price → 0
});

test('end-to-end: sell vs buy proceeds differ by exactly the broker fee', () => {
  const acct = 5, broker = 5, faction = 0, corp = 0;
  const st = TM.salesTax(acct);
  const bf = TM.brokerFee(broker, faction, corp);
  const price = { buy: 100, sell: 100 };  // equal both sides isolates the fee difference
  const sellNet = TM.pickPrice(price, 'sell') * TM.netFactor('sell', st, bf);
  const buyNet  = TM.pickPrice(price, 'buy')  * TM.netFactor('buy',  st, bf);
  approx(buyNet - sellNet, 100 * bf);     // buy keeps the broker fee the seller would pay
});
