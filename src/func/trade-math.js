// ─── trade-math.js — pure market-fee math for the Ore/Ice/Gas/Moon calculators ──
// No DOM, no globals: every function takes explicit inputs so it can be unit
// tested under Node (`node --test`) and reused in the browser via window.TradeMath.
// Loaded as a plain <script> before blueprints.js, and require()-d by the tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;     // Node / tests
  if (typeof window !== 'undefined') window.TradeMath = api;                      // renderer
  else if (typeof globalThis !== 'undefined') globalThis.TradeMath = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Sales tax fraction. Accounting reduces the base (8%) by 11% per level.
  function salesTax(accounting, base) {
    const b = base == null ? 0.08 : base;
    return Math.max(0, b * (1 - 0.11 * (accounting || 0)));
  }

  // Broker fee fraction. Broker Relations + faction/corp standing reduce the base (3%).
  function brokerFee(brokerRelations, factionStanding, corpStanding, base) {
    const b = base == null ? 0.03 : base;
    const fee = b
      - 0.003  * (brokerRelations || 0)
      - 0.0003 * (factionStanding || 0)
      - 0.0002 * (corpStanding   || 0);
    return Math.max(0, fee);
  }

  // Net multiplier on the gross sale value for the chosen method.
  //   buy  → instant sell into buy orders: sales tax only (no broker fee)
  //   sell / split → place a sell order: broker fee + sales tax
  function netFactor(method, salesTaxFrac, brokerFeeFrac) {
    return method === 'buy'
      ? 1 - (salesTaxFrac || 0)
      : 1 - (salesTaxFrac || 0) - (brokerFeeFrac || 0);
  }

  // Unit price for the chosen method from a { buy, sell } entry. Falls back to the
  // other side when one is missing so a thin market still yields a number.
  function pickPrice(p, method) {
    if (!p) return 0;
    const sell = p.sell > 0 ? p.sell : 0;
    const buy  = p.buy  > 0 ? p.buy  : 0;
    if (method === 'buy')   return buy || sell;
    if (method === 'split') return (buy && sell) ? (buy + sell) / 2 : (sell || buy);
    return sell || buy;
  }

  // ISK per ore unit from reprocessing into a single output material.
  //   matQtyPerBatch: material units yielded per `batchSize` ore units (base, pre-skill)
  //   refineEff: 0..1 reprocessing efficiency;  netFactor: market-fee multiplier
  // EVE floors the yielded material per reprocessing batch.
  function reprocessUnitValue(matQtyPerBatch, matPrice, refineEff, batchSize, netFactor) {
    if (!batchSize) return 0;
    const yielded = Math.floor((matQtyPerBatch || 0) * (refineEff || 0));
    return (yielded * (matPrice || 0) * (netFactor == null ? 1 : netFactor)) / batchSize;
  }

  return { salesTax, brokerFee, netFactor, pickPrice, reprocessUnitValue };
});
