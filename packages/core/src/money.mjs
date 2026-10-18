/**
 * Monetary accounting: all values are integer euro cents.
 * Customers pay food + delivery, never a card surcharge or BaitMe fee.
 * On a successfully delivered paid order, RESTAURANT owes fixed EUR 0.50
 * to BaitMe plus the verified processor charges. No live transfers are made here.
 */
export const RESTAURANT_PLATFORM_FEE_CENTS = 50;

export function assertCents(n,label="amount") {
  if (!Number.isSafeInteger(n) || n<0)
    throw new RangeError(label+" must be non-negative integer cents");
  return n;
}

export function quote(items, deliveryCents, processingFeeCents=0) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  assertCents(deliveryCents, "deliveryCents");
  assertCents(processingFeeCents,"processingFeeCents");
  let foodCents=0;
  for (const item of items) {
    assertCents(item.priceCents,"priceCents");
    if (!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>20) {
      throw new RangeError("item quantity must be 1..20");
    }
    foodCents+=item.priceCents*item.quantity;
    assertCents(foodCents,"foodCents");
  }
  const totalCents=foodCents+deliveryCents+processingFeeCents;
  assertCents(totalCents,"totalCents");
  return Object.freeze({
    foodCents,deliveryCents,processingFeeCents,totalCents,
    restaurantCents:foodCents,courierCents:deliveryCents,
    baitmeCustomerFeeCents:0
  });
}

/**
 * This is a settlement PROJECTION, not a payment or platform payout.
 * Stripe processor fee is charged to restaurant economically, while its
 * technical collection depends on Connect charge type.
 */
export function restaurantSettlement({
  foodCents,deliveryCents,processorFeeCents=0,paid=false,delivered=false
}) {
  assertCents(foodCents,"foodCents");
  assertCents(deliveryCents,"deliveryCents");
  assertCents(processorFeeCents,"processorFeeCents");
  if(typeof paid!=="boolean"||typeof delivered!=="boolean")
    throw new TypeError("paid and delivered must be booleans");
  if(delivered&&!paid) throw new RangeError("An unpaid delivery cannot settle");
  const platformFeeCents=delivered?RESTAURANT_PLATFORM_FEE_CENTS:0;
  const courierEarnedCents=delivered?deliveryCents:0;
  const restaurantNetCents=foodCents-processorFeeCents-platformFeeCents;
  // If restaurant net is negative, no payout can occur; shortfall is payable
  // through a separately reconciled balance/contractual debt process.
  return Object.freeze({
    foodCents,deliveryCents,processorFeeCents,platformFeeCents,
    courierEarnedCents,restaurantNetCents,
    restaurantPayoutCandidateCents:Math.max(0,restaurantNetCents),
    restaurantShortfallCents:Math.max(0,-restaurantNetCents),
    baitmeCustomerFeeCents:0
  });
}

export function currency(cents) {
  return (assertCents(cents)/100).toLocaleString("lv-LV",{style:"currency",currency:"EUR"});
}
