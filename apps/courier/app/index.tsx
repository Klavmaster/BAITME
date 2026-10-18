import {useEffect,useState} from 'react';
import {SafeAreaView,Text,TextInput,View,ScrollView,Pressable,StyleSheet,ActivityIndicator} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import type {Session} from '@supabase/supabase-js';
import {api,configured,supabase} from '../src/client';
type Job={
 id:string;restaurant_id:string;address_line:string;postal_code:string;
 delivery_cents:number;status:string;created_at:string;payment_status?:string;
};
const V='#694EEB',D='#242032';
const euro=(n:number)=>(n/100).toFixed(2).replace('.',',')+' €';
export default function CourierApp(){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [available,setAvailable]=useState<Job[]>([]),[mine,setMine]=useState<Job[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[]);
 async function login(){
  if(!supabase)return;
  setBusy(true);setError('');
  const {error:e}=await supabase.auth.signInWithPassword({email,password});
  if(e)setError('Pārbaudi e-pastu un paroli.');setBusy(false);
 }
 async function refresh(token:string){
  setBusy(true);setError('');
  try{
   const [a,m]=await Promise.all([
    api<{jobs:Job[]}>('/v1/courier/jobs',token),
    api<{orders:Job[]}>('/v1/courier/mine',token)
   ]);
   setAvailable(a.jobs);setMine(m.orders);
  }catch(e){setError(e instanceof Error?e.message:'Savienojuma kļūda');}
  finally{setBusy(false);}
 }
 useEffect(()=>{if(session?.access_token)void refresh(session.access_token);
 else{setAvailable([]);setMine([]);}
 },[session?.user.id]);
 async function change(id:string,kind:'claim'|'picked_up'|'delivered'){
  if(!session)return;
  setBusy(true);setError('');
  try{
   await api('/v1/courier/jobs/'+id+'/'+(kind==='claim'?'claim':'status'),
    session.access_token,{method:'POST',...(kind==='claim'?{}:{body:JSON.stringify({status:kind})})});
   await refresh(session.access_token);
  }catch(e){setError(e instanceof Error?e.message:'Neizdevās mainīt statusu');setBusy(false);}
 }
 if(!configured)return <SafeAreaView style={s.shell}><Text style={s.title}>BaitMe Kurjers</Text>
 <Text style={s.muted}>Pievieno Supabase un API adreses Expo vidē.</Text></SafeAreaView>;
 if(loading)return <SafeAreaView style={s.shell}><ActivityIndicator color={V}/></SafeAreaView>;
 return <SafeAreaView style={s.shell}><StatusBar style="dark"/>
  <ScrollView contentContainerStyle={s.body}>
   <Text style={s.brand}>bait<Text style={{color:V}}>me.</Text> <Text style={s.small}>KURJERIEM</Text></Text>
   {!session?<View style={s.card}><Text style={s.title}>Kurjera konts</Text>
     <Text style={s.muted}>Pieejams tikai apstiprinātiem kurjeriem.</Text>
     <TextInput style={s.input} placeholder="E-pasts" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
     <TextInput style={s.input} placeholder="Parole" secureTextEntry value={password} onChangeText={setPassword}/>
     <Pressable style={s.button} disabled={busy} onPress={login}><Text style={s.white}>Ieiet</Text></Pressable>
   </View>:<>
     <Text style={s.title}>Piegādes uzdevumi</Text>
     <View style={s.banner}><Text style={s.bannerTitle}>100% piegādes maksa tev</Text>
     <Text style={s.muted}>Atlīdzība tiek uzskaitīta tikai pēc apmaksātas un pabeigtas piegādes.</Text></View>
     <Pressable style={s.secondary} disabled={busy} onPress={()=>void refresh(session.access_token)}>
      <Text style={s.secondaryText}>Atjaunot sarakstu</Text></Pressable>
     <Text style={s.section}>Pieejamie pasūtījumi</Text>
     {!available.length&&<Text style={s.muted}>Pašlaik nav pieejamu piegāžu.</Text>}
     {available.map(j=><View key={j.id} style={s.card}>
       <Text style={s.rowTitle}>Uzdevums #{j.id.slice(0,8)}</Text>
       <Text style={s.muted}>{j.address_line}, {j.postal_code}</Text>
       <Text style={s.money}>{euro(j.delivery_cents)}</Text>
       <Pressable style={s.button} disabled={busy} onPress={()=>void change(j.id,'claim')}>
        <Text style={s.white}>Pieņemt piegādi</Text></Pressable>
     </View>)}
     <Text style={s.section}>Manas piegādes</Text>
     {!mine.length&&<Text style={s.muted}>Vēl nav pieņemtu piegāžu.</Text>}
     {mine.map(j=><View key={j.id} style={s.card}>
       <Text style={s.rowTitle}>#{j.id.slice(0,8)} · {j.status}</Text>
       <Text style={s.muted}>{j.address_line}, {j.postal_code}</Text>
       <Text style={s.money}>{euro(j.delivery_cents)}</Text>
       {j.status==='ready_for_pickup'&&<Pressable style={s.button} disabled={busy} onPress={()=>void change(j.id,'picked_up')}>
        <Text style={s.white}>Ēdiens saņemts</Text></Pressable>}
       {j.status==='picked_up'&&<Pressable style={s.button} disabled={busy} onPress={()=>void change(j.id,'delivered')}>
        <Text style={s.white}>Piegāde pabeigta</Text></Pressable>}
       {j.status==='delivered'&&<Text style={s.muted}>Atlīdzība uzskaitīta, izmaksai vajadzīga Stripe integrācija.</Text>}
     </View>)}
     <Pressable style={s.secondary} onPress={()=>void supabase?.auth.signOut()}><Text style={s.secondaryText}>Iziet</Text></Pressable>
   </>}
   {!!error&&<Text style={s.error}>{error}</Text>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 shell:{flex:1,backgroundColor:'#F7F7FC'},body:{padding:22,paddingBottom:80,gap:15},
 brand:{fontSize:28,fontWeight:'900',color:D,marginBottom:10},small:{fontSize:10,color:V},
 title:{fontSize:24,color:D,fontWeight:'900'},section:{fontSize:20,fontWeight:'900',color:D,marginTop:10},
 banner:{backgroundColor:'#DDF6AB',borderRadius:18,padding:20,gap:9},
 bannerTitle:{fontSize:19,fontWeight:'900',color:'#304522'},
 muted:{fontSize:13,color:'#726D82',lineHeight:20},
 card:{borderWidth:1,borderColor:'#EAE7F1',borderRadius:18,backgroundColor:'white',padding:18,gap:12},
 rowTitle:{color:D,fontSize:16,fontWeight:'800'},
 money:{fontSize:20,fontWeight:'900',color:V},input:{height:49,backgroundColor:'#F1EFF8',borderRadius:13,padding:13},
 button:{backgroundColor:V,borderRadius:12,padding:15,alignItems:'center'},
 white:{color:'white',fontWeight:'800'},secondary:{backgroundColor:'#EAE6FF',padding:14,alignItems:'center',borderRadius:13},
 secondaryText:{color:V,fontWeight:'800'},error:{color:'#B42F49',fontSize:13}
});
