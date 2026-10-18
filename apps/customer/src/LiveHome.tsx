import 'react-native-url-polyfill/auto';
import {useEffect,useMemo,useState} from 'react';
import {SafeAreaView,ScrollView,Text,TextInput,View,Pressable,StyleSheet,ActivityIndicator} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import {createClient,type Session} from '@supabase/supabase-js';

type Restaurant={id:string;name:string;description:string;category:string;image_url:string|null;delivery_eta_min:number;delivery_eta_max:number};
type Item={id:string;name:string;description:string;price_cents:number;category:string};
type Zone={id:string;name:string;postal_code_prefix:string;delivery_cents:number};
type Order={id:string;status:string;payment_status:string;total_cents:number;food_cents:number;created_at:string};
type Complaint={id:string;status:string;category:string;customer_description:string;requested_refund_cents:number;
 restaurant_response:string|null;restaurant_recommended_cents:number|null;review_note:string|null;approved_refund_cents:number|null;};
type LocationSample={latitude:number;longitude:number;accuracyM:number;updatedAt:string};
type MenuResponse={restaurant:Restaurant;items:Item[];deliveryZones:Zone[]};

const V='#694EEB',INK='#242032';
const apiUrl=(process.env.EXPO_PUBLIC_API_URL||'').replace(/\/$/,'');
const supabase=createClient(
 process.env.EXPO_PUBLIC_SUPABASE_URL||'https://invalid.supabase.co',
 process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'not-configured',
 {auth:{
  storage:{
   getItem:(key)=>SecureStore.getItemAsync(key),
   setItem:(key,value)=>SecureStore.setItemAsync(key,value),
   removeItem:(key)=>SecureStore.deleteItemAsync(key)
  },
  autoRefreshToken:true,persistSession:true,detectSessionInUrl:false
 }}
);
const money=(c:number)=>(c/100).toFixed(2).replace('.',',')+' €';
async function request<T>(path:string,token?:string,init?:RequestInit):Promise<T>{
 const response=await fetch(apiUrl+path,{
  ...init,headers:{...(token?{Authorization:'Bearer '+token}:{}),
  ...(init?.body?{'Content-Type':'application/json'}:{}),...init?.headers}
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error || 'API kļūda');
 return data as T;
}
function Button({children,onPress,disabled=false,secondary=false}:{
 children:string;onPress:()=>void;disabled?:boolean;secondary?:boolean
}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
   style={[styles.button,secondary&&styles.secondary,disabled&&styles.inactive]}>
  <Text style={[styles.buttonLabel,secondary&&styles.secondaryLabel]}>{children}</Text>
 </Pressable>;
}
export default function LiveHome(){
 const [session,setSession]=useState<Session|null>(null);
 const [restaurants,setRestaurants]=useState<Restaurant[]>([]);
 const [restaurant,setRestaurant]=useState<Restaurant|null>(null);
 const [items,setItems]=useState<Item[]>([]),[zones,setZones]=useState<Zone[]>([]);
 const [zoneId,setZoneId]=useState(''),[basket,setBasket]=useState<Record<string,number>>({});
 const [view,setView]=useState<'home'|'menu'|'cart'|'login'|'orders'|'complaint'>('home');
 const [search,setSearch]=useState(''),[address,setAddress]=useState(''),[postal,setPostal]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [orders,setOrders]=useState<Order[]>([]),[message,setMessage]=useState('');
 const [complaintOrder,setComplaintOrder]=useState<Order|null>(null);
 const [complaint,setComplaint]=useState<Complaint|null>(null);
 const [complaintCategory,setComplaintCategory]=useState('missing_item');
 const [complaintText,setComplaintText]=useState(''),[refundEuro,setRefundEuro]=useState('');
 const [locationSample,setLocationSample]=useState<LocationSample|null>(null);
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{void refreshRestaurants();},[]);
 async function guard(task:()=>Promise<void>){
  setBusy(true);setError('');setMessage('');
  try{await task();}catch(e){setError(e instanceof Error?e.message:'Neizdevās pabeigt darbību');}
  finally{setBusy(false);}
 }
 async function refreshRestaurants(){
  try{const r=await request<{restaurants:Restaurant[]}>('/v1/restaurants');setRestaurants(r.restaurants);}
  catch(e){setError(e instanceof Error?e.message:'Nav pieejams restorānu katalogs');}
 }
 async function openRestaurant(r:Restaurant){
  await guard(async()=>{
   const result=await request<MenuResponse>('/v1/restaurants/'+r.id+'/menu');
   setRestaurant(result.restaurant);setItems(result.items);setZones(result.deliveryZones);
   setZoneId(result.deliveryZones[0]?.id||'');setBasket({});setView('menu');
  });
 }
 const selectedZone=zones.find(z=>z.id===zoneId);
 const basketItems=items.filter(x=>(basket[x.id]||0)>0);
 const count=basketItems.reduce((s,x)=>s+basket[x.id],0);
 const foodCents=basketItems.reduce((s,x)=>s+x.price_cents*basket[x.id],0);
 const deliveryCents=count?selectedZone?.delivery_cents||0:0;
 const totalCents=foodCents+deliveryCents;
 const visible=useMemo(()=>restaurants.filter(r=>
  (r.name+' '+r.category).toLocaleLowerCase('lv-LV').includes(search.toLocaleLowerCase('lv-LV'))
 ),[restaurants,search]);
 function change(itemId:string,delta:number){
  setBasket(b=>{
   const next={...b};next[itemId]=Math.max(0,(next[itemId]||0)+delta);
   if(!next[itemId])delete next[itemId];
   return next;
  });
 }
 async function auth(mode:'in'|'up'){
  await guard(async()=>{
   if(!email.includes('@')||password.length<8)throw Error('Ievadi e-pastu un paroli (vismaz 8 simboli)');
   if(mode==='in'){
    const {error:e}=await supabase.auth.signInWithPassword({email,password});
    if(e)throw new Error('Pieteikšanās neizdevās');
    setView('cart');
   } else{
    const {error:e,data}=await supabase.auth.signUp({email,password});
    if(e)throw new Error('Reģistrācija neizdevās');
    setMessage(data.session?'Konts izveidots.':'Pārbaudi e-pastu un apstiprini reģistrāciju.');
    if(data.session)setView('cart');
   }
  });
 }
 async function makeDraft(){
  await guard(async()=>{
   const token=(await supabase.auth.getSession()).data.session?.access_token;
   if(!token){setView('login');return;}
   if(!restaurant||!selectedZone||!count)throw Error('Izvēlies restorānu un ēdienu');
   const normalized=postal.trim().toUpperCase();
   if(!/^LV-[0-9]{4}$/.test(normalized)||address.trim().length<8)
    throw Error('Ievadi adresi un pasta indeksu LV-1234');
   const payload=await request<{orderId:string;checkoutAvailable:boolean}>('/v1/orders',token,{
    method:'POST',body:JSON.stringify({
     restaurantId:restaurant.id,deliveryZoneId:selectedZone.id,addressLine:address.trim(),
     postalCode:normalized,items:basketItems.map(i=>({menuItemId:i.id,quantity:basket[i.id]}))
    })
   });
   setMessage('Testa pasūtījuma uzmetums #'+payload.orderId.slice(0,8)+' saglabāts. Tas NAV apmaksāts un NETIKS piegādāts.');
   setBasket({});
   setView('orders');
   await loadOrders(token);
  });
 }
 async function loadOrders(token:string){
  const r=await request<{orders:Order[]}>('/v1/orders/mine',token);
  setOrders(r.orders);
 }
 async function openComplaint(order:Order){
  const token=(await supabase.auth.getSession()).data.session?.access_token;
  if(!token)return;
  await guard(async()=>{
   setComplaintOrder(order);setComplaint(null);setComplaintText('');
   const r=await request<{complaint:Complaint|null}>('/v1/orders/'+order.id+'/complaint',token);
   setComplaint(r.complaint);setView('complaint');
  });
 }
 async function sendComplaint(){
  if(!complaintOrder)return;
  await guard(async()=>{
   const token=(await supabase.auth.getSession()).data.session?.access_token;
   if(!token)throw new Error('Pieslēdzies vēlreiz');
   const cents=Math.round(Number(refundEuro.replace(',','.'))*100);
   if(!Number.isSafeInteger(cents)||cents<1||cents>complaintOrder.food_cents)
    throw new Error('Atmaksas pieprasījums nedrīkst pārsniegt ēdiena summu');
   await request('/v1/orders/'+complaintOrder.id+'/complaint',token,{
    method:'POST',body:JSON.stringify({category:complaintCategory,description:complaintText,
    requestedRefundCents:cents})
   });
   const r=await request<{complaint:Complaint|null}>('/v1/orders/'+complaintOrder.id+'/complaint',token);
   setComplaint(r.complaint);
   setMessage('Sūdzība iesniegta. Restorāns sniegs atbildi, pēc tam to izskatīs BaitMe operators.');
  });
 }
 async function loadCourierLocation(order:Order){
  const token=(await supabase.auth.getSession()).data.session?.access_token;
  if(!token)return;
  await guard(async()=>{
   const result=await request<{location:LocationSample|null}>('/v1/orders/'+order.id+'/courier-location',token);
   setLocationSample(result.location);
   setMessage(result.location?'Atrašanās vieta saņemta. Tā tiek atjaunota tikai ar kurjera piekrišanu.':
    'Kurjera atrašanās vieta nav pieejama vai kopīgošana ir izslēgta.');
  });
 }
 async function showOrders(){
  const token=(await supabase.auth.getSession()).data.session?.access_token;
  if(!token){setView('login');return;}
  await guard(async()=>{await loadOrders(token);setView('orders');});
 }
 return <SafeAreaView style={styles.shell}><StatusBar style="dark"/>
  <View style={styles.header}>
   <Pressable accessibilityRole="button" onPress={()=>setView('home')}>
    <Text style={styles.brand}>bait<Text style={{color:V}}>me.</Text></Text>
   </Pressable>
   <Pressable accessibilityRole="button" onPress={()=>void showOrders()}>
    <Text style={styles.headerLink}>Mani pasūtījumi</Text>
   </Pressable>
  </View>
  <ScrollView contentContainerStyle={styles.content}>
   {view==='home'&&<>
    <Text style={styles.eyebrow}>Piegāde Latvijā</Text>
    <Text style={styles.title}>Ko garšīgu šodien?</Text>
    <Text style={styles.muted}>Ēdiens bez BaitMe komisijas, piegāde no restorāna.</Text>
    <TextInput placeholder="Meklēt restorānus..." value={search} onChangeText={setSearch} style={styles.input}/>
    <View style={styles.banner}>
     <Text style={styles.bannerTitle}>0% platformas komisija ✨</Text>
     <Text style={styles.bannerText}>Restorāns sedz maksājumu apstrādes izmaksas. Kurjers saņem pilnu piegādes maksu.</Text>
    </View>
    <Text style={styles.subtitle}>Restorāni</Text>
    {!visible.length&&<Text style={styles.muted}>Restorānu vēl nav. Biznesa panelī jāievada un jāpublicē restorāni.</Text>}
    {visible.map(r=><Pressable key={r.id} accessibilityRole="button" style={styles.card} onPress={()=>void openRestaurant(r)}>
      <View style={styles.art}><Text style={{fontSize:40}}>🍽️</Text></View>
      <Text style={styles.cardTitle}>{r.name}</Text>
      <Text style={styles.muted}>{r.description||r.category}</Text>
      <Text style={styles.small}>{r.category} · {r.delivery_eta_min}–{r.delivery_eta_max} min</Text>
    </Pressable>)}
   </>}
   {view==='menu'&&<>
    <Text style={styles.eyebrow}>Restorāns</Text>
    <Text style={styles.title}>{restaurant?.name}</Text>
    <Text style={styles.muted}>{restaurant?.description}</Text>
    <Text style={styles.subtitle}>Ēdienkarte</Text>
    {items.map(i=><View key={i.id} style={styles.menuRow}>
     <View style={{flex:1,gap:5}}>
      <Text style={styles.cardTitle}>{i.name}</Text>
      <Text style={styles.muted}>{i.description}</Text>
      <Text style={styles.price}>{money(i.price_cents)}</Text>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel={'Pievienot '+i.name}
      onPress={()=>change(i.id,1)} style={styles.add}><Text style={styles.addText}>+</Text></Pressable>
    </View>)}
    <Button onPress={()=>setView('home')} secondary>Atpakaļ uz restorāniem</Button>
   </>}
   {view==='cart'&&<>
    <Text style={styles.eyebrow}>Pasūtījuma pārskats</Text>
    <Text style={styles.title}>Tavs grozs</Text>
    <Text style={styles.muted}>{restaurant?.name||'Izvēlies restorānu'}</Text>
    {basketItems.map(i=><View key={i.id} style={styles.cartRow}>
     <View style={{flex:1}}><Text style={styles.cardTitle}>{i.name}</Text><Text style={styles.muted}>{money(i.price_cents)}</Text></View>
     <Pressable onPress={()=>change(i.id,-1)} style={styles.pill}><Text>−</Text></Pressable>
     <Text style={styles.count}>{basket[i.id]}</Text>
     <Pressable onPress={()=>change(i.id,1)} style={styles.pill}><Text>+</Text></Pressable>
    </View>)}
    <Text style={styles.subtitle}>Piegādes adrese</Text>
    <TextInput placeholder="Iela, mājas un dzīvokļa numurs" style={styles.input} value={address} onChangeText={setAddress}/>
    <TextInput placeholder="LV-1234" style={styles.input} value={postal} onChangeText={setPostal} autoCapitalize="characters"/>
    <Text style={styles.muted}>Izvēlies restorāna piegādes zonu. Pasta indeksam ar to jāsakrīt.</Text>
    {zones.map(z=><Pressable key={z.id} onPress={()=>setZoneId(z.id)} style={[styles.zone,zoneId===z.id&&styles.zoneSelected]}>
      <Text style={styles.cardTitle}>{zoneId===z.id?'◉':'○'} {z.name}</Text>
      <Text style={styles.muted}>{z.postal_code_prefix} · {money(z.delivery_cents)}</Text>
    </Pressable>)}
    <View style={styles.bill}>
     <View style={styles.billRow}><Text>Ēdiens</Text><Text>{money(foodCents)}</Text></View>
     <View style={styles.billRow}><Text>Piegāde</Text><Text>{money(deliveryCents)}</Text></View>
     <View style={styles.billRow}><Text>BaitMe komisija</Text><Text>0,00 €</Text></View>
     <View style={styles.billRow}><Text>Maksājumu apstrādes piemaksa</Text><Text>0,00 €</Text></View>
     <View style={styles.billRow}><Text style={styles.cardTitle}>Kopā</Text><Text style={styles.cardTitle}>{money(totalCents)}</Text></View>
    </View>
    <Text style={styles.muted}>Maksājumu apstrādes izmaksas sedz restorāns no ēdiena ieņēmumiem. Klientam nav papildu kartes piemaksas. Maksājumi vēl nav pieslēgti.</Text>
    <Button disabled={!count||busy||!selectedZone} onPress={()=>void makeDraft()}>Izveidot tikai testa pasūtījumu</Button>
    <Text style={styles.warning}>Tas nav īsts pasūtījums! Ēdiens netiks gatavots un kurjers netiks nosūtīts.</Text>
   </>}
   {view==='complaint'&&<>
      <Text style={styles.eyebrow}>Sūdzības izskatīšana</Text>
      <Text style={styles.title}>Problēma ar pasūtījumu</Text>
      <Text style={styles.muted}>Pasūtījums #{complaintOrder?.id.slice(0,8)}</Text>
      {complaint?<View style={styles.card}>
        <Text style={styles.cardTitle}>Statuss: {complaint.status}</Text>
        <Text style={styles.muted}>Pieprasīts: {money(complaint.requested_refund_cents)}</Text>
        <Text style={styles.muted}>{complaint.customer_description}</Text>
        {complaint.restaurant_response&&<><Text style={styles.cardTitle}>Restorāna atbilde</Text>
          <Text style={styles.muted}>{complaint.restaurant_response}</Text></>}
        {complaint.review_note&&<><Text style={styles.cardTitle}>Izmeklēšanas lēmums</Text>
          <Text style={styles.muted}>{complaint.review_note}</Text></>}
        {complaint.approved_refund_cents!=null&&<Text style={styles.price}>
          Apstiprināta daļējā atmaksa: {money(complaint.approved_refund_cents)}</Text>}
        {complaint.status==='approved_pending_refund'&&<Text style={styles.warning}>
          Lēmums apstiprināts, taču maksājums vēl nav nosūtīts uz Stripe. Atmaksas termiņu skaita no tās uzsākšanas, nevis lēmuma dienas.</Text>}
        {complaint.status==='refund_submitted'&&<Text style={styles.muted}>
          Atmaksa nosūtīta maksājumu apstrādātājam. Parasti 5–10 darba dienas (aptuveni 14 kalendārās), atkarībā no bankas var ilgāk.</Text>}
      </View>:<>
        <Text style={styles.subtitle}>Kas notika?</Text>
        {([['missing_item','Trūkst ēdiena'],['wrong_item','Nepareizs ēdiens'],['quality','Kvalitāte'],['delivery_issue','Piegādes problēma'],['other','Cits']] as const)
         .map(([key,label])=><Pressable key={key} onPress={()=>setComplaintCategory(key)}
           style={[styles.zone,complaintCategory===key&&styles.zoneSelected]}>
           <Text style={styles.cardTitle}>{complaintCategory===key?'◉':'○'} {label}</Text></Pressable>)}
        <TextInput style={[styles.input,{minHeight:120}]} multiline placeholder="Apraksti problēmu (vismaz 15 simboli)" value={complaintText} onChangeText={setComplaintText}/>
        <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="Vēlamā daļējā atmaksa €" value={refundEuro} onChangeText={setRefundEuro}/>
        <Text style={styles.muted}>Restorāns atbildēs, un BaitMe operators izskatīs pieprasījumu. Restorāns pats neveic automātisku atmaksu.</Text>
        <Button disabled={busy||complaintText.trim().length<15} onPress={()=>void sendComplaint()}>Iesniegt sūdzību</Button>
      </>}
      <Button secondary onPress={()=>setView('orders')}>Atpakaļ uz pasūtījumiem</Button>
   </>}
   {view==='login'&&<>
    <Text style={styles.title}>Klienta konts</Text>
    <Text style={styles.muted}>Lai saglabātu testa pasūtījumu, pieslēdzies.</Text>
    <TextInput placeholder="E-pasts" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
    <TextInput placeholder="Parole" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry/>
    <Button disabled={busy} onPress={()=>void auth('in')}>Ieiet</Button>
    <Button disabled={busy} secondary onPress={()=>void auth('up')}>Reģistrēties</Button>
    {session&&<Button secondary onPress={()=>setView('cart')}>Atgriezties grozā</Button>}
   </>}
   {view==='orders'&&<>
    <Text style={styles.title}>Mani pasūtījumi</Text>
    <Text style={styles.warning}>Maksājumi nav pieslēgti. Sarakstā redzamie pasūtījumi ir testa uzmetumi, nevis aktīvas piegādes.</Text>
    {!orders.length&&<Text style={styles.muted}>Vēl nav testa pasūtījumu.</Text>}
    {orders.map(o=><View key={o.id} style={styles.card}>
     <Text style={styles.cardTitle}>#{o.id.slice(0,8)}</Text>
     <Text style={styles.muted}>{o.status} · {money(o.total_cents)}</Text>
     {['paid','partially_refunded'].includes(o.payment_status)&&<>
       <Button secondary onPress={()=>void openComplaint(o)}>Sūdzība / atmaksa</Button>
       {['ready_for_pickup','picked_up'].includes(o.status)&&
         <Button secondary onPress={()=>void loadCourierLocation(o)}>Atjaunot kurjera atrašanās vietu</Button>}
     </>}
    </View>)}
    {locationSample&&<View style={styles.card}>
      <Text style={styles.cardTitle}>Kurjera atrašanās vieta</Text>
      <Text style={styles.muted}>{locationSample.latitude.toFixed(5)}, {locationSample.longitude.toFixed(5)}</Text>
      <Text style={styles.muted}>Precizitāte: {Math.round(locationSample.accuracyM)} m. Aktualizēts: {new Date(locationSample.updatedAt).toLocaleTimeString('lv-LV')}</Text>
      <Text style={styles.muted}>Kartes attēlojums tiks pieslēgts nākamajā fāzē.</Text>
    </View>}
    {session&&<Button secondary onPress={()=>void supabase.auth.signOut()}>Iziet no konta</Button>}
    <Button onPress={()=>setView('home')}>Atpakaļ uz sākumu</Button>
   </>}
   {!!error&&<Text style={styles.error}>{error}</Text>}
   {!!message&&<Text style={styles.notice}>{message}</Text>}
  </ScrollView>
  {view==='menu'&&count>0&&<Pressable accessibilityRole="button" style={styles.cartBar} onPress={()=>setView('cart')}>
   <Text style={styles.cartBarText}>{count} ēdieni · Skatīt grozu</Text><Text style={styles.cartBarText}>{money(totalCents)} →</Text>
  </Pressable>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 shell:{flex:1,backgroundColor:'#F7F7FC'},header:{paddingHorizontal:24,paddingTop:18,paddingBottom:16,backgroundColor:'white',
   flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 brand:{fontWeight:'900',fontSize:28,color:INK,letterSpacing:-1},headerLink:{color:V,fontWeight:'800',fontSize:12},
 content:{padding:23,gap:15,paddingBottom:80},
 eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1,color:V,textTransform:'uppercase'},
 title:{fontSize:28,color:INK,fontWeight:'900',letterSpacing:-.6},
 subtitle:{fontSize:21,color:INK,fontWeight:'900',marginTop:10},
 muted:{fontSize:13,color:'#797386',lineHeight:21},
 input:{backgroundColor:'white',borderWidth:1,borderColor:'#E9E6F2',borderRadius:16,padding:14,minHeight:52},
 banner:{backgroundColor:'#DFF5B7',padding:20,borderRadius:21,gap:8},
 bannerTitle:{fontSize:19,fontWeight:'900',color:'#344928'},
 bannerText:{fontSize:13,color:'#50663D',lineHeight:20},
 card:{backgroundColor:'white',borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'#EAE7F0',padding:16,gap:8},
 art:{backgroundColor:'#FBE4D1',margin:-16,marginBottom:8,height:100,alignItems:'center',justifyContent:'center'},
 cardTitle:{fontSize:16,fontWeight:'800',color:INK},small:{fontSize:12,color:V,fontWeight:'700'},
 menuRow:{backgroundColor:'white',borderColor:'#ECE9F2',borderWidth:1,borderRadius:17,padding:17,
 flexDirection:'row',alignItems:'center',gap:14},price:{color:INK,fontWeight:'900',marginTop:7},
 add:{backgroundColor:V,width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'},
 addText:{color:'white',fontSize:25},button:{backgroundColor:V,padding:16,alignItems:'center',borderRadius:14},
 buttonLabel:{color:'white',fontWeight:'900',fontSize:14},secondary:{backgroundColor:'#EDE9FF'},
 secondaryLabel:{color:V},inactive:{opacity:.45},
 cartRow:{backgroundColor:'white',borderRadius:13,padding:13,flexDirection:'row',alignItems:'center',gap:12},
 pill:{borderRadius:10,backgroundColor:'#EEE9FF',padding:10},
 count:{width:20,textAlign:'center',fontWeight:'800'},
 zone:{borderWidth:1,borderColor:'#ECE9F2',borderRadius:14,padding:13,backgroundColor:'white',gap:4},
 zoneSelected:{borderColor:V,backgroundColor:'#F3F0FF'},
 bill:{backgroundColor:'white',padding:20,borderRadius:18,gap:14},
 billRow:{flexDirection:'row',justifyContent:'space-between',gap:10},
 cartBar:{backgroundColor:V,marginHorizontal:16,marginBottom:12,padding:18,borderRadius:16,
  flexDirection:'row',justifyContent:'space-between'},cartBarText:{color:'white',fontWeight:'900'},
 warning:{fontSize:12,color:'#9C5434',lineHeight:19},error:{color:'#B92F49',backgroundColor:'#FFE5EA',
  padding:15,borderRadius:12},notice:{backgroundColor:'#E6F5D8',padding:15,borderRadius:12,color:'#38632C'}
});
