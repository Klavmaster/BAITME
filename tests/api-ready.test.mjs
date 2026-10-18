import test from "node:test";
import assert from "node:assert/strict";
import {app} from "../services/api/src/server.mjs";

test("liveness works without server credentials and payments remain disabled",async()=>{
 const server=await new Promise(resolve=>{
   const instance=app.listen(0,"127.0.0.1",()=>resolve(instance));
 });
 try {
   const address=server.address();
   const base="http://127.0.0.1:"+address.port;
   const health=await fetch(base+"/health");
   assert.equal(health.status,200);
   assert.deepEqual(await health.json(),{ok:true,app:"baitme",payments:false});
   if(!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY){
     const ready=await fetch(base+"/ready");
     assert.equal(ready.status,503);
     assert.deepEqual(await ready.json(),{ready:false,database:false,payments:false});
   }
 } finally {
   await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});
