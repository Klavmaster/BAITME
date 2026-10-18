import test from "node:test";
import assert from "node:assert/strict";
import {quote} from "../packages/core/src/money.mjs";
import {mayTransition} from "../packages/core/src/status.mjs";
test("restaurant receives 100% of food and courier 100% of delivery",()=>{
 const q=quote([{priceCents:2000,quantity:1}],350);
 assert.deepEqual(q,{foodCents:2000,deliveryCents:350,processingFeeCents:0,
 totalCents:2350,restaurantCents:2000,courierCents:350,baitmeCommissionCents:0});
});
test("processing simulation remains separable",()=>{
 const q=quote([{priceCents:2000,quantity:1}],350,61);
 assert.equal(q.totalCents,2411);
 assert.equal(q.restaurantCents,2000);
 assert.equal(q.courierCents,350);
});
test("money and quantities reject invalid values",()=>{
 assert.throws(()=>quote([{priceCents:-1,quantity:1}],0));
 assert.throws(()=>quote([{priceCents:100,quantity:0}],0));
 assert.throws(()=>quote([],0,-10));
 assert.throws(()=>quote([{priceCents:100,quantity:21}],0));
});
test("only couriers can deliver; restaurant cannot claim",()=>{
 assert.equal(mayTransition("ready_for_pickup","picked_up","restaurant"),false);
 assert.equal(mayTransition("ready_for_pickup","picked_up","courier"),true);
 assert.equal(mayTransition("awaiting_payment","placed","courier"),false);
 assert.equal(mayTransition("picked_up","delivered","courier"),true);
});
