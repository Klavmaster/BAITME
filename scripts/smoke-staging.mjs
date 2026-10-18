#!/usr/bin/env node
/**
 * BaitMe remote staging smoke check. Uses no secrets and performs only GETs.
 * Intended for GitHub Actions runners with external HTTPS/DNS access.
 * Checks process health, real Supabase connectivity, public restaurant
 * catalog, unauthenticated access denial, and the business web homepage.
 */
import assert from 'node:assert/strict';

const api=(process.env.BAITME_STAGING_API_URL||'https://baitme-api-staging.up.railway.app').replace(/\/$/,'');
const web=(process.env.BAITME_STAGING_WEB_URL||'https://baitme-business-web-staging.up.railway.app').replace(/\/$/,'');
const retries=Number(process.env.STAGING_SMOKE_RETRIES||30);
const delayMs=Number(process.env.STAGING_SMOKE_DELAY_MS||5000);
const timeoutMs=Number(process.env.STAGING_SMOKE_TIMEOUT_MS||9000);

if(!Number.isSafeInteger(retries)||retries<1||retries>60||
 !Number.isSafeInteger(delayMs)||delayMs<0||delayMs>30000||
 !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)
 throw new Error('Invalid smoke limits');
if(![api,web].every(value=>value.startsWith('https://')))
 throw new Error('Staging smoke requires HTTPS');

async function get(url){
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(timeoutMs),redirect:'error',headers:{'accept':'application/json, text/html'}});
 const text=await response.text();
 return {status:response.status,text};
}
async function check(){
 const health=await get(api+'/health');
 assert.equal(health.status,200,'GET /health must return HTTP 200');
 const healthBody=JSON.parse(health.text);
 assert.equal(healthBody.ok,true);
 assert.equal(healthBody.payments,false,'Live payments must remain OFF');

 const ready=await get(api+'/ready');
 assert.equal(ready.status,200,'GET /ready must connect to Supabase (HTTP 200)');
 const readyBody=JSON.parse(ready.text);
 assert.equal(readyBody.ready,true,'Database should be ready');
 assert.equal(readyBody.database,true,'Database should be reachable');
 assert.equal(readyBody.payments,false,'Stripe remains disabled');

 const catalog=await get(api+'/v1/restaurants');
 assert.equal(catalog.status,200,'Restaurant catalog must be available');
 const catalogBody=JSON.parse(catalog.text);
 assert.ok(Array.isArray(catalogBody.restaurants),'Catalog should be an array');

 const forbidden=await get(api+'/v1/me');
 assert.equal(forbidden.status,401,'Private profile must reject anonymous clients');

 // Ensure the NEW category/location endpoints are deployed, and privileged
 // configuration remains inaccessible without a valid user session.
 const unknownRestaurant='00000000-0000-4000-8000-000000000000';
 for(const route of ['categories','location','zones']){
  const denied=await get(api+'/v1/restaurant/'+unknownRestaurant+'/'+route);
  assert.equal(denied.status,401,
   'Private restaurant '+route+' endpoint must exist and reject anonymous access');
 }

 const home=await get(web+'/');
 assert.equal(home.status,200,'Business website must return HTTP 200');
 assert.match(home.text,/baitme|bait.{0,30}me/i,'Business website should render BaitMe');
 return {catalogSize:catalogBody.restaurants.length};
}

let lastError;
for(let attempt=1;attempt<=retries;attempt++){
 try {
  const result=await check();
  console.log('PASS BaitMe staging API + Supabase + authentication + business web');
  console.log('Restaurants currently published:',result.catalogSize);
  console.log('Payments: DISABLED');
  process.exit(0);
 } catch(error) {
  lastError=error;
  console.error('Attempt '+attempt+'/'+retries+': '+(error instanceof Error?error.message:String(error)));
  if(attempt<retries)await new Promise(resolve=>setTimeout(resolve,delayMs));
 }
}
console.error('FAIL staging smoke: '+(lastError instanceof Error?lastError.message:String(lastError)));
process.exitCode=1;
