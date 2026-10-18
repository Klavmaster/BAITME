/**
 * Money as integer euro cents. No platform commission / subscription.
 * Processing surcharges for ordinary Latvian/EEA consumer cards remain zero.
 */
export function assertCents(n,label="amount") {
  if (!Number.isSafeInteger(n) || n<0) throw new RangeError(label+" must be non-negative integer cents");
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
    baitmeCommissionCents:0
  });
}
export function currency(cents) {
  return (assertCents(cents)/100).toLocaleString("lv-LV",{style:"currency",currency:"EUR"});
}
