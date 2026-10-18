/**
 * Creates only git-ignored PUBLIC staging client configuration.
 * This script never stores backend secrets or deploys anything.
 * Will not overwrite an existing file unless --force is explicitly supplied.
 */
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
const projectRoot=resolve(import.meta.dirname,"..");
const force=process.argv.includes("--force");
const templates=[
  ["apps/customer/.env.local", "EXPO_PUBLIC_API_URL=https://baitme-api-staging.up.railway.app\nEXPO_PUBLIC_SUPABASE_URL=https://hwsbsdjrehjeqzxxcksr.supabase.co\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rMaWllKg6wReQysyJ99cKQ_vmI04Btd\n"],
  ["apps/restaurant/.env.local", "EXPO_PUBLIC_API_URL=https://baitme-api-staging.up.railway.app\nEXPO_PUBLIC_SUPABASE_URL=https://hwsbsdjrehjeqzxxcksr.supabase.co\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rMaWllKg6wReQysyJ99cKQ_vmI04Btd\n"],
  ["apps/courier/.env.local", "EXPO_PUBLIC_API_URL=https://baitme-api-staging.up.railway.app\nEXPO_PUBLIC_SUPABASE_URL=https://hwsbsdjrehjeqzxxcksr.supabase.co\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rMaWllKg6wReQysyJ99cKQ_vmI04Btd\n"],
  ["apps/business-web/.env.local", "NEXT_PUBLIC_API_URL=https://baitme-api-staging.up.railway.app\nNEXT_PUBLIC_SUPABASE_URL=https://hwsbsdjrehjeqzxxcksr.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rMaWllKg6wReQysyJ99cKQ_vmI04Btd\n"]
];
for(const [path,contents] of templates){
  const destination=resolve(projectRoot,path);
  await mkdir(dirname(destination),{recursive:true});
  if(!force){
    try {await readFile(destination);console.log("SKIP: "+path+" exists, unchanged");continue;}
    catch(error){if(error?.code!=="ENOENT")throw error;}
  }
  await writeFile(destination,contents,{mode:0o600});
  console.log("CREATED: "+path);
}
console.log("Client staging config prepared. Server secret must be set ONLY in Railway variables.");
