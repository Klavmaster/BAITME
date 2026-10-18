import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const url=process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publishableKey=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const apiUrl=(process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export const configured=Boolean(url&&publishableKey&&apiUrl);

const storage={
  getItem: (key:string)=>SecureStore.getItemAsync(key),
  setItem: (key:string,value:string)=>SecureStore.setItemAsync(key,value),
  removeItem: (key:string)=>SecureStore.deleteItemAsync(key),
};

export const supabase:SupabaseClient|null=configured
 ?createClient(url,publishableKey,{
    auth:{storage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}
  }):null;

export async function api<T>(path:string,accessToken:string,init?:RequestInit):Promise<T>{
  const response=await fetch(apiUrl+path,{
    ...init,headers:{
      'Authorization':'Bearer '+accessToken,
      ...(init?.body?{'Content-Type':'application/json'}:{}),
      ...(init?.headers||{})
    }
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error || 'API kļūda '+response.status);
  return payload as T;
}
