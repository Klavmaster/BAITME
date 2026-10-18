import test from "node:test";
import assert from "node:assert/strict";
import {quote,restaurantSettlement,RESTAURANT_PLATFORM_FEE_CENTS} from "../packages/core/src/money.mjs";
import {mayTransition} from "../packages/core/src/status.mjs";

test("customer pays only food and courier delivery",()=>{
 const q=quote([{priceCents:2000,quantity:1}],350);
 assert.deepEqual(q,{foodCents:2000,deliveryCents:350,processingFeeCents:0,
 totalCents:2350,restaurantCents:2000,courierCents:350,baitmeCustomerFeeCents:0});
});
test("illustrative legacy processing simulation remains separate from platform fee",()=>{
 const q=quote([{priceCents:2000,quantity:1}],350,61);
 assert.equal(q.totalCents,2411);
 assert.equal(q.restaurantCents,2000);
 assert.equal(q.courierCents,350);
});
test("EUR 0.50 platform fee is earned only after paid and completed delivery",()=>{
 assert.equal(RESTAURANT_PLATFORM_FEE_CENTS,50);
 assert.deepEqual(restaurantSettlement({
   foodCents:2000,deliveryCents:350,processorFeeCents:61,paid:true,delivered:true
 }),{
   foodCents:2000,deliveryCents:350,processorFeeCents:61,platformFeeCents:50,
   courierEarnedCents:350,restaurantNetCents:1889,
   restaurantPayoutCandidateCents:1889,restaurantShortfallCents:0,
   baitmeCustomerFeeCents:0
 });
});
test("an undelivered or cancelled order never accrues BaitMe fixed fee",()=>{
 const settlement=restaurantSettlement({foodCents:2000,deliveryCents:350,paid:true,delivered:false});
 assert.equal(settlement.platformFeeCents,0);
 assert.equal(settlement.courierEarnedCents,0);
});
test("tiny or unprofitable restaurant sales do not cause negative transfers",()=>{
 const settlement=restaurantSettlement({
  foodCents:40,deliveryCents:350,processorFeeCents:15,paid:true,delivered:true
 });
 assert.equal(settlement.platformFeeCents,50);
 assert.equal(settlement.restaurantNetCents,-25);
 assert.equal(settlement.restaurantPayoutCandidateCents,0);
 assert.equal(settlement.restaurantShortfallCents,25);
});
test("bad cents and unpaid delivery are rejected",()=>{
 assert.throws(()=>quote([{priceCents:-1,quantity:1}],0));
 assert.throws(()=>quote([{priceCents:100,quantity:0}],0));
 assert.throws(()=>quote([],0,-10));
 assert.throws(()=>quote([{priceCents:100,quantity:21}],0));
 assert.throws(()=>restaurantSettlement({foodCents:100,deliveryCents:100,paid:false,delivered:true}));
});
test("only couriers can deliver; restaurant cannot claim",()=>{
 assert.equal(mayTransition("ready_for_pickup","picked_up","restaurant"),false);
 assert.equal(mayTransition("ready_for_pickup","picked_up","courier"),true);
 assert.equal(mayTransition("awaiting_payment","placed","courier"),false);
 assert.equal(mayTransition("picked_up","delivered","courier"),true);
});
