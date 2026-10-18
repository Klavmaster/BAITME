export const orderTransitions = Object.freeze({
  awaiting_payment: [],
  placed: ["accepted","cancelled"],
  accepted: ["preparing","cancelled"],
  preparing: ["ready_for_pickup","cancelled"],
  ready_for_pickup: ["picked_up","cancelled"],
  picked_up: ["delivered"],
  delivered: [],
  cancelled: []
});
export const restaurantTransitions = Object.freeze({
  placed: ["accepted","cancelled"],
  accepted: ["preparing","cancelled"],
  preparing: ["ready_for_pickup","cancelled"]
});
export const courierTransitions = Object.freeze({
  ready_for_pickup: ["picked_up"],
  picked_up: ["delivered"]
});
export function mayTransition(from,to,by) {
  const map=by==="restaurant"?restaurantTransitions:by==="courier"?courierTransitions:orderTransitions;
  return (map[from]||[]).includes(to);
}
