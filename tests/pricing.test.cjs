const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBreakdown, formatEuro } = require('../apps/customer/src/lib/pricing');

test('food + delivery is exactly the amount paid; zero platform fees', () => {
  const result = calculateBreakdown([
    { unitPriceCents: 890, quantity: 2 },
    { unitPriceCents: 320, quantity: 1 },
  ], 250);
  assert.equal(result.foodCents, 2100);
  assert.equal(result.deliveryCents, 250);
  assert.equal(result.totalCents, 2350);
  assert.equal(result.restaurantReceivesCents, 2100);
  assert.equal(result.courierReceivesCents, 250);
  assert.equal(result.baitmeCommissionCents, 0);
  assert.equal(result.customerServiceFeeCents, 0);
  assert.equal(result.restaurantReceivesCents + result.courierReceivesCents, result.totalCents);
});
test('empty basket has no surcharge', () => {
  const result = calculateBreakdown([], 0);
  assert.equal(result.totalCents, 0);
  assert.equal(result.baitmeCommissionCents, 0);
});
test('reject invalid monetary values or quantities', () => {
  assert.throws(() => calculateBreakdown([{ unitPriceCents: 1.4, quantity: 1 }], 200));
  assert.throws(() => calculateBreakdown([{ unitPriceCents: -10, quantity: 1 }], 200));
  assert.throws(() => calculateBreakdown([{ unitPriceCents: 100, quantity: 0 }], 200));
  assert.throws(() => calculateBreakdown([], -1));
  assert.throws(() => calculateBreakdown([], 1.5));
  assert.throws(() => calculateBreakdown([{unitPriceCents:Number.MAX_SAFE_INTEGER,quantity:2}],0));
});
test('euro formatting uses two decimals', () => {
  assert.equal(formatEuro(2350), '23,50 €');
  assert.equal(formatEuro(0), '0,00 €');
});
