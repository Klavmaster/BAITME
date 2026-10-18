import { createClient } from "@supabase/supabase-js";
let serviceClient, authClient;
function requireConfig(name) {
  const value=process.env[name];
  if(!value) throw new Error("Missing environment configuration: "+name);
  return value;
}
function requireOne(names) {
  for(const name of names) if(process.env[name]) return process.env[name];
  throw new Error("Missing environment configuration: "+names.join(" or "));
}
export function db() {
  if(!serviceClient) serviceClient=createClient(requireConfig("SUPABASE_URL"),requireOne(["SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY"]),{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  return serviceClient;
}
export async function authenticate(token) {
  if (!token || token.length>8192) return null;
  if(!authClient) authClient=createClient(requireConfig("SUPABASE_URL"),requireOne(["SUPABASE_PUBLISHABLE_KEY","SUPABASE_ANON_KEY"]),{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await authClient.auth.getUser(token);
  return error?null:(data.user||null);
}
export async function hasRestaurantRole(userId,restaurantId,allowedRoles=null) {
  const {data,error}=await db().from("restaurant_staff")
    .select("restaurant_id,role").eq("user_id",userId).eq("restaurant_id",restaurantId).limit(1);
  if (error) throw error;
  return data.length>0 && (!allowedRoles || allowedRoles.includes(data[0].role));
}
export async function hasCourierRole(userId) {
  const {data,error}=await db().from("courier_profiles")
   .select("user_id").eq("user_id",userId).eq("approved",true).limit(1);
  if(error) throw error;
  return data.length>0;
}
