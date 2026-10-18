/**
 * Integer-cents pricing. No real money is charged by this prototype.
 * Processing surcharge is DEMO ONLY; collecting a fee for card choice is
 * prohibited for ordinary consumer EEA cards under Latvian / EU rules.
 */
function checkCents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(name + ' must be a non-negative integer number of cents');
  }
}

function calculateBreakdown(lines, deliveryCents, processingFeeCents = 0) {
  if (!Array.isArray(lines)) throw new Error('lines must be an array');
  checkCents(deliveryCents, 'deliveryCents');
  checkCents(processingFeeCents, 'processingFeeCents');
  const foodCents = lines.reduce((sum, line) => {
    checkCents(line.unitPriceCents, 'unitPriceCents');
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('quantity must be a positive integer');
    }
    const next = sum + line.unitPriceCents * line.quantity;
    if (!Number.isSafeInteger(next)) throw new Error('amount overflow');
    return next;
  }, 0);
  const totalCents = foodCents + deliveryCents + processingFeeCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error('amount overflow');

  return Object.freeze({
    foodCents,
    deliveryCents,
    processingFeeCents,
    totalCents,
    restaurantReceivesCents: foodCents,
    courierReceivesCents: deliveryCents,
    baitmeCommissionCents: 0,
    customerServiceFeeCents: 0,
  });
}

/**
 * Illustrative gross-up only, NOT a chargeable quote and NOT a legal permission
 * to surcharge. Percentage is computed on the entire payment including fee.
 * Real connected account and payment-method costs will differ.
 */
function estimateProcessingFeeCents(baseCents, rateBps = 150, fixedCents = 25) {
  checkCents(baseCents, 'baseCents');
  checkCents(fixedCents, 'fixedCents');
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps >= 10000) {
    throw new Error('rateBps must be an integer between 0 and 9999');
  }
  if (baseCents === 0) return 0;
  const initial = Math.ceil((baseCents + fixedCents) / (1 - rateBps / 10000));
  if (!Number.isSafeInteger(initial)) throw new Error('amount overflow');
  let grossCents = initial;
  // Round down to the first payable cent, then correct any shortfall.
  // Percentage fee itself is rounded to integer cents.
  while (grossCents > baseCents &&
         grossCents - 1 - Math.round((grossCents - 1) * rateBps / 10000) - fixedCents >= baseCents) {
    grossCents--;
  }
  while (grossCents - Math.round(grossCents * rateBps / 10000) - fixedCents < baseCents) {
    grossCents++;
    if (!Number.isSafeInteger(grossCents)) throw new Error('amount overflow');
  }
  return grossCents - baseCents;
}

function formatEuro(cents) {
  checkCents(cents, 'cents');
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

module.exports = { calculateBreakdown, estimateProcessingFeeCents, formatEuro };
