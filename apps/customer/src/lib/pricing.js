/**
 * Pure pricing rules. All amounts are in integer cents to avoid floating-point
 * rounding. This prototype intentionally does NOT charge a customer.
 */
function checkCents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(name + ' must be a non-negative integer number of cents');
  }
}

function calculateBreakdown(lines, deliveryCents) {
  if (!Array.isArray(lines)) throw new Error('lines must be an array');
  checkCents(deliveryCents, 'deliveryCents');

  const foodCents = lines.reduce((sum, line) => {
    checkCents(line.unitPriceCents, 'unitPriceCents');
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('quantity must be a positive integer');
    }
    const next = sum + line.unitPriceCents * line.quantity;
    if (!Number.isSafeInteger(next)) throw new Error('amount overflow');
    return next;
  }, 0);

  const totalCents = foodCents + deliveryCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error('amount overflow');

  return Object.freeze({
    foodCents,
    deliveryCents,
    totalCents,
    restaurantReceivesCents: foodCents,
    courierReceivesCents: deliveryCents,
    baitmeCommissionCents: 0,
    customerServiceFeeCents: 0,
  });
}

function formatEuro(cents) {
  checkCents(cents, 'cents');
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

module.exports = { calculateBreakdown, formatEuro };
