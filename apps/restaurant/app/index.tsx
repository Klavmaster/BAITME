import {useEffect,useState} from 'react';
import {SafeAreaView,Text,TextInput,View,ScrollView,Pressable,StyleSheet,ActivityIndicator} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {StatusBar} from 'expo-status-bar';
import {api,configured,supabase} from '../src/client';

type Restaurant={id:string;name:string;role:string;published:boolean};
type Order={
 id:string;status:string;payment_status:string;address_line:string;
 postal_code:string;food_cents:number;delivery_cents:number;total_cents:number;
 order_items:{name:string;quantity:number}[];created_at:string;
};
const V='#694EEB', D='#242032';
const euro=(c:number)=>(c/100).toFixed(2).replace('.',',')+' €';
const actions:Record<string,string>={
 placed:'accepted',accepted:'preparing',preparing:'ready_for_pickup'
};
const labels:Record<string,string>={
 accepted:'Pieņemt pasūtījumu',preparing:'Sākt gatavošanu',
 ready_for_pickup:'Gatavs kurjeram'
};

export default function RestaurantApp(){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [restaurants,setRestaurants]=useState<Restaurant[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [orders,setOrders]=useState<Order[]>([]);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[]);
 async function login(){
  if(!supabase)return;
  setBusy(true);setError('');
  const {error:e}=await supabase.auth.signInWithPassword({email,password});
  if(e)setError('Pieteikšanās neizdevās. Pārbaudi piekļuvi.');
  setBusy(false);
 }
 async function refresh(token:string,restaurantId?:string){
  setBusy(true);setError('');
  try{
   const mine=await api<{restaurants:Restaurant[]}>('/v1/restaurant/mine',token);
   setRestaurants(mine.restaurants);
   const id=restaurantId && mine.restaurants.some(r=>r.id===restaurantId)
     ?restaurantId:mine.restaurants[0]?.id || null;
   setSelected(id);
   if(id){
     const response=await api<{orders:Order[]}>('/v1/restaurant/'+id+'/orders',token);
     setOrders(response.orders);
   } else setOrders([]);
  }catch(e){setError(e instanceof Error?e.message:'Savienojuma kļūda');}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  if(session?.access_token)void refresh(session.access_token);
  else {setRestaurants([]);setSelected(null);setOrders([]);}
 },[session?.user.id]);
 async function transition(order:Order,target:string){
  if(!session||!selected)return;
  setBusy(true);setError('');
  try{
   await api('/v1/restaurant/'+selected+'/orders/'+order.id+'/status',session.access_token,{
    method:'POST',body:JSON.stringify({status:target})
   });
   await refresh(session.access_token,selected);
  }catch(e){setError(e instanceof Error?e.message:'Neizdevās atjaunot');setBusy(false);}
 }
 if(!configured)return <SafeAreaView style={s.shell}><Text style={s.title}>BaitMe Restorāns</Text>
  <Text style={s.note}>Pievieno SUPABASE_URL, SUPABASE_ANON_KEY un API_URL Expo vidē. Skati .env.example.</Text></SafeAreaView>;
 if(loading)return <SafeAreaView style={s.shell}><ActivityIndicator color={V}/></SafeAreaView>;
 return <SafeAreaView style={s.shell}>
  <StatusBar style="dark"/>
  <ScrollView contentContainerStyle={s.body}>
   <Text style={s.brand}>bait<Text style={{color:V}}>me.</Text> <Text style={s.subbrand}>RESTORĀNIEM</Text></Text>
   {!session?<View style={s.card}>
      <Text style={s.title}>Restorāna konts</Text>
      <Text style={s.note}>Pieslēdzies ar savu apstiprināto uzņēmuma kontu.</Text>
      <TextInput style={s.input} placeholder="E-pasts" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
      <TextInput style={s.input} placeholder="Parole" value={password} onChangeText={setPassword} secureTextEntry/>
      <Pressable style={s.button} onPress={login} disabled={busy}><Text style={s.buttonText}>Ieiet</Text></Pressable>
   </View>:<>
      <Text style={s.title}>Pasūtījumu pārvaldība</Text>
      <Text style={s.note}>Ēdienkaršu un piegādes zonu rediģēšana pieejama biznesa panelī.</Text>
      {restaurants.map(r=><Pressable key={r.id} style={[s.row,selected===r.id&&s.selected]}
       onPress={()=>void refresh(session.access_token,r.id)}>
        <Text style={s.rowTitle}>{r.name}</Text><Text style={s.note}>{r.published?'Publicēts':'Nav publicēts'}</Text>
       </Pressable>)}
      <Pressable style={s.secondary} onPress={()=>void refresh(session.access_token,selected||undefined)} disabled={busy}>
       <Text style={s.secondaryText}>Atjaunot pasūtījumus</Text></Pressable>
      {orders.length===0&&<Text style={s.note}>Šobrīd nav pasūtījumu.</Text>}
      {orders.map(o=><View key={o.id} style={s.card}>
       <Text style={s.rowTitle}>Pasūtījums #{o.id.slice(0,8)}</Text>
       <Text style={s.note}>{o.address_line}, {o.postal_code}</Text>
       <Text style={s.note}>Statuss: {o.status} · Maksājums: {o.payment_status}</Text>
       {o.order_items?.map((i,idx)=><Text key={idx} style={s.item}>{i.quantity} × {i.name}</Text>)}
       <Text style={s.earnings}>Restorānam: {euro(o.food_cents)}</Text>
       {o.payment_status==='paid'&&actions[o.status]&&<Pressable
        onPress={()=>void transition(o,actions[o.status])} style={s.button} disabled={busy}>
         <Text style={s.buttonText}>{labels[actions[o.status]]}</Text></Pressable>}
      </View>)}
      <Pressable onPress={()=>void supabase?.auth.signOut()} style={s.secondary}><Text style={s.secondaryText}>Iziet</Text></Pressable>
    </>}
   {!!error&&<Text style={s.error}>{error}</Text>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 shell:{flex:1,backgroundColor:'#F7F7FC'},body:{padding:22,paddingBottom:70,gap:15},
 brand:{fontSize:28,fontWeight:'900',color:D,marginBottom:12},subbrand:{fontSize:10,color:V},
 title:{fontSize:24,fontWeight:'900',color:D},note:{fontSize:13,lineHeight:20,color:'#726D82'},
 card:{backgroundColor:'white',borderRadius:19,padding:19,gap:12,borderWidth:1,borderColor:'#EAE7F1'},
 input:{backgroundColor:'#F1EFF8',borderRadius:12,height:48,padding:13},
 button:{backgroundColor:V,padding:15,borderRadius:13,alignItems:'center',marginTop:5},
 buttonText:{fontSize:14,color:'white',fontWeight:'800'},secondary:{backgroundColor:'#EAE6FF',borderRadius:12,padding:13,alignItems:'center'},
 secondaryText:{color:V,fontWeight:'800'},row:{backgroundColor:'white',borderWidth:1,borderColor:'#E7E4F0',borderRadius:14,padding:15,gap:5},
 selected:{borderColor:V},rowTitle:{fontSize:16,fontWeight:'800',color:D},
 item:{fontSize:14,color:D},earnings:{fontSize:17,fontWeight:'800',color:V},
 error:{color:'#AE2C3F',fontSize:13,padding:10}
});
