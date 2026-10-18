"use client";
import {useEffect,useState} from "react";
import {createClient,type SupabaseClient,type Session} from "@supabase/supabase-js";
type Restaurant={id:string;name:string;role:string;published:boolean;slug:string};
type Menu={id:string;name:string;description:string;category:string;price_cents:number;available:boolean};
type Category={id:string;name:string;sort_order:number};
type Zone={id:string;name:string;zone_type:"postal_prefix"|"radius";postal_code_prefix:string|null;min_distance_m:number|null;max_distance_m:number|null;delivery_cents:number;active:boolean};
type Location={pickup_address:string|null;latitude:number|null;longitude:number|null};
type Order={id:string;status:string;payment_status:string;food_cents:number;restaurant_processing_fee_cents:number;platform_fee_cents:number;delivery_cents:number;total_cents:number;address_line:string;postal_code:string;order_items:{name:string;quantity:number}[]};
type Summary={totalOrders:number;paidOrders:number;foodCents:number;processorCents:number;baitmePlatformFeeCents:number;netRestaurantCents:number;pendingOrders:number};
type Complaint={id:string;order_id:string;category:string;customer_description:string;
 requested_refund_cents:number;status:string;restaurant_response:string|null;
 restaurant_recommended_cents:number|null;review_note:string|null;approved_refund_cents:number|null;created_at:string};
const API=process.env.NEXT_PUBLIC_API_URL||"";
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";
const configured=!!(API&&URL&&KEY);
const money=(c:number)=>(c/100).toFixed(2).replace(".",",")+" €";
const flow:Record<string,string>={placed:"accepted",accepted:"preparing",preparing:"ready_for_pickup"};
const actionLabel:Record<string,string>={accepted:"Pieņemt",preparing:"Gatavošanā",ready_for_pickup:"Gatavs"};
function safeError(e:unknown){return e instanceof Error?e.message:"Nezināma kļūda";}
export default function Page(){
 const [client]=useState<SupabaseClient|null>(()=>configured?createClient(URL,KEY):null);
 const [session,setSession]=useState<Session|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [restaurants,setRestaurants]=useState<Restaurant[]>([]),[rid,setRid]=useState("");
 const [tab,setTab]=useState<"orders"|"menu"|"zones"|"complaints">("orders");
 const [orders,setOrders]=useState<Order[]>([]);
 const [complaints,setComplaints]=useState<Complaint[]>([]);
 const [responses,setResponses]=useState<Record<string,string>>({});
 const [recommendations,setRecommendations]=useState<Record<string,string>>({});
 const [menu,setMenu]=useState<Menu[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [newCategory,setNewCategory]=useState("");
 const [zones,setZones]=useState<Zone[]>([]);
 const [location,setLocation]=useState<Location>({pickup_address:null,latitude:null,longitude:null});
 const [pickupAddress,setPickupAddress]=useState(""),[pickupLat,setPickupLat]=useState(""),[pickupLng,setPickupLng]=useState("");
 const [summary,setSummary]=useState<Summary>({totalOrders:0,paidOrders:0,foodCents:0,processorCents:0,baitmePlatformFeeCents:0,netRestaurantCents:0,pendingOrders:0});
 const [itemName,setItemName]=useState(""),[itemPrice,setItemPrice]=useState(""),[itemCategory,setItemCategory]=useState("");
 const [zoneName,setZoneName]=useState(""),[zoneMinKm,setZoneMinKm]=useState("0"),[zoneMaxKm,setZoneMaxKm]=useState("3"),[zonePrice,setZonePrice]=useState("3,50");
 useEffect(()=>{
  if(!client){setReady(true);return;}
  void client.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[client]);
 async function api<T>(path:string,init?:RequestInit):Promise<T>{
  const token=(await client?.auth.getSession())?.data.session?.access_token;
  if(!token)throw new Error("Sesija beigusies");
  const response=await fetch(API.replace(/\/$/,"")+path,{
   ...init,headers:{Authorization:"Bearer "+token,...(init?.body?{"Content-Type":"application/json"}:{}),...init?.headers}
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json.error||"Servera kļūda");
  return json as T;
 }
 async function call(action:()=>Promise<void>){
  setBusy(true);setError("");
  try{await action();}catch(e){setError(safeError(e));}
  finally{setBusy(false);}
 }
 async function loadRestaurant(id:string){
  const [o,m,z,stats,cases,cat,loc]=await Promise.all([
   api<{orders:Order[]}>("/v1/restaurant/"+id+"/orders"),
   api<{items:Menu[]}>("/v1/restaurant/"+id+"/menu"),
   api<{zones:Zone[]}>("/v1/restaurant/"+id+"/zones"),
   api<{summary:Summary}>("/v1/restaurant/"+id+"/summary"),
   api<{complaints:Complaint[]}>("/v1/restaurant/"+id+"/complaints"),
   api<{categories:Category[]}>("/v1/restaurant/"+id+"/categories"),
   api<{location:Location}>("/v1/restaurant/"+id+"/location")
  ]);
  setOrders(o.orders);setMenu(m.items);setZones(z.zones);setSummary(stats.summary);setComplaints(cases.complaints);
  setCategories(cat.categories);
  setItemCategory(v=>cat.categories.some(c=>c.name===v)?v:cat.categories[0]?.name||"");
  setLocation(loc.location);
  setPickupAddress(loc.location.pickup_address||"");
  setPickupLat(loc.location.latitude==null?"":String(loc.location.latitude));
  setPickupLng(loc.location.longitude==null?"":String(loc.location.longitude));
 }
 useEffect(()=>{
  if(!session){setRestaurants([]);setRid("");return;}
  let valid=true;
  void api<{restaurants:Restaurant[]}>("/v1/restaurant/mine")
   .then(async ({restaurants:r})=>{
    if(!valid)return;
    setRestaurants(r);
    if(r.length){setRid(r[0].id);await loadRestaurant(r[0].id);}
   }).catch(e=>{if(valid)setError(safeError(e));});
  return ()=>{valid=false;};
 },[session?.user.id]);
 const current=restaurants.find(r=>r.id===rid);
 async function login(){
  if(!client)return;
  await call(async()=>{
   const {error:e}=await client.auth.signInWithPassword({email,password});
   if(e)throw new Error("Pieteikšanās neizdevās");
  });
 }
 async function addMenu(e:React.FormEvent){
  e.preventDefault();
  await call(async()=>{
   const cents=Math.round(Number(itemPrice.replace(",","."))*100);
   if(!Number.isFinite(cents)||cents<0)throw new Error("Nepareiza cena");
   await api("/v1/restaurant/"+rid+"/menu",{method:"POST",body:JSON.stringify({
    name:itemName,description:"",category:itemCategory,priceCents:cents
   })});
   setItemName("");setItemPrice("");await loadRestaurant(rid);
  });
 }
 async function addCategory(e:React.FormEvent){
  e.preventDefault();
  await call(async()=>{
   await api("/v1/restaurant/"+rid+"/categories",{
    method:"POST",body:JSON.stringify({name:newCategory.trim()})
   });
   setNewCategory("");
   await loadRestaurant(rid);
  });
 }
 async function moveCategory(id:string,direction:"up"|"down"){
  await call(async()=>{
   await api("/v1/restaurant/"+rid+"/categories/"+id+"/move",{
    method:"POST",body:JSON.stringify({direction})
   });
   await loadRestaurant(rid);
  });
 }
 async function saveLocation(e:React.FormEvent){
  e.preventDefault();
  await call(async()=>{
   if(!pickupLat.trim()||!pickupLng.trim())throw Error("Ievadi restorāna platuma un garuma koordinātas");
   const latitude=Number(pickupLat.replace(",","."));
   const longitude=Number(pickupLng.replace(",","."));
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
      latitude< -90||latitude>90||longitude< -180||longitude>180)
    throw Error("Koordinātām jābūt derīgā formātā");
   await api("/v1/restaurant/"+rid+"/location",{
    method:"PUT",body:JSON.stringify({pickupAddress,latitude,longitude})
   });
   await loadRestaurant(rid);
  });
 }
 function zoneBand(z:Zone){
  return z.zone_type==="radius"
   ?(z.min_distance_m!/1000).toLocaleString("lv-LV")+"–"+(z.max_distance_m!/1000).toLocaleString("lv-LV")+" km no restorāna"
   :"Vecā indeksa zona: "+z.postal_code_prefix;
 }
 async function updateZone(id:string,change:Record<string,number|boolean|string>){
  await call(async()=>{
   await api("/v1/restaurant/"+rid+"/zones/"+id,{
    method:"PATCH",body:JSON.stringify(change)
   });
   await loadRestaurant(rid);
  });
 }
 async function addZone(e:React.FormEvent){
  e.preventDefault();
  await call(async()=>{
   const cents=Math.round(Number(zonePrice.replace(",","."))*100);
   const minKm=Number(zoneMinKm.replace(",",".")),maxKm=Number(zoneMaxKm.replace(",","."));
   const minDistanceM=Math.round(minKm*1000),maxDistanceM=Math.round(maxKm*1000);
   if(!Number.isSafeInteger(cents)||cents<0||!Number.isFinite(minKm)||!Number.isFinite(maxKm)||
      !Number.isSafeInteger(minDistanceM)||!Number.isSafeInteger(maxDistanceM)||
      minDistanceM<0||maxDistanceM<=minDistanceM)
     throw new Error("Norādi derīgu piegādes cenu un intervālu kilometros");
   await api("/v1/restaurant/"+rid+"/zones",{method:"POST",body:JSON.stringify({
    name:zoneName,minDistanceM,maxDistanceM,deliveryCents:cents
   })});
   setZoneName("");setZoneMinKm(zoneMaxKm);setZoneMaxKm(String(maxKm+3));
   await loadRestaurant(rid);
  });
 }
 if(!configured)return <main><h1>BaitMe biznesa panelis</h1>
  <p className="notice">Konfigurācijā nav Supabase un API publisko adrešu. Skati projekta .env.example.</p></main>;
 if(!ready)return <main><h1>BaitMe</h1><p>Savienojam kontu…</p></main>;
 return <main>
  <header className="top"><div className="brand">bait<span>me.</span><div className="eyebrow">Restorāna vadības panelis</div></div>
   <div className="cardActions"><a className="secondary" href="/apply">Pieteikties</a><a className="secondary" href="/admin">Operators</a>
    {session&&<button className="secondary" onClick={()=>void client?.auth.signOut()}>Iziet</button>}</div></header>
  {!session?<section className="panel" style={{maxWidth:500,margin:"80px auto"}}>
    <p className="eyebrow">Restorāna konts</p><h1>Laipni lūdzam atpakaļ!</h1>
    <p className="muted">Pieslēdzies ar savu apstiprināto restorāna lietotāja kontu.</p>
    <form onSubmit={e=>{e.preventDefault();void login();}} className="fields" style={{flexDirection:"column",alignItems:"stretch"}}>
      <div className="field"><label>E-pasts</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></div>
      <div className="field"><label>Parole</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></div>
      <button className="primary" disabled={busy}>Ieiet</button>
    </form>
   </section>:<>
    <p className="eyebrow">Biznesa pārskats</p>
    <h1>Viss restorānam vienuviet</h1>
    <p className="muted">Fiksēta BaitMe maksa 0,50 € par pabeigtu pasūtījumu · ēdienkarte · individuālas piegādes zonas</p>
    {restaurants.length?<div className="fields"><div className="field" style={{maxWidth:350}}><label>Restorāns</label>
     <select value={rid} onChange={e=>void call(async()=>{setRid(e.target.value);await loadRestaurant(e.target.value);})}>
      {restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
     </select></div>
     <button className="secondary" disabled={busy||!rid} onClick={()=>void call(()=>loadRestaurant(rid))}>Atjaunot</button>
    </div>:<p className="notice">Tavam kontam nav piešķirta piekļuve restorānam. Administrators pievieno kontu restaurant_staff tabulā.</p>}
    {current&&<><div className="grid">
      <div className="panel green"><p className="eyebrow">Restorāna provizoriskie ieņēmumi</p><p className="kpi">{money(summary.netRestaurantCents)}</p><p className="muted">Apmaksātā ēdiena summa {money(summary.foodCents)} − Stripe apstrāde {money(summary.processorCents)} − BaitMe 0,50 € maksa par pabeigtiem pasūtījumiem {money(summary.baitmePlatformFeeCents)}. Pirms atmaksām, nodokļu korekcijām un faktiskiem pārskaitījumiem.</p></div>
      <div className="panel"><p className="eyebrow">Pasūtījumi</p><p className="kpi">{summary.totalOrders}</p><p className="muted">{summary.paidOrders} apmaksāti</p></div>
      <div className="panel"><p className="eyebrow">Aktīvie pasūtījumi</p><p className="kpi">{summary.pendingOrders}</p><p className="muted">Nepabeigtās piegādes</p></div>
    </div>
    <div className="tabs">{([["orders","Pasūtījumi"],["menu","Ēdienkarte"],["zones","Piegādes zonas"],["complaints","Sūdzības"]] as const)
      .map(([id,label])=><button key={id} className={"tab "+(tab===id?"active":"")} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==="orders"&&<section className="panel"><h2>Pasūtījumu saraksts</h2>
     {!orders.length&&<div className="empty">Pasūtījumu vēl nav.</div>}
     {orders.map(o=><div key={o.id} className="row"><div>
      <strong>#{o.id.slice(0,8)}</strong> <span className="badge">{o.status}</span>
      <small>{o.address_line}, {o.postal_code} · {o.payment_status}</small>
      <small>{o.order_items?.map(i=>i.quantity+" × "+i.name).join(" · ")}</small>
      <small>Ēdiens: {money(o.food_cents)} · Stripe apstrāde: {money(o.restaurant_processing_fee_cents)} · BaitMe fiksētā maksa: {money(o.platform_fee_cents)} · Piegāde: {money(o.delivery_cents)}</small>
      </div><div className="cardActions"><strong>{money(o.total_cents)}</strong>
      {o.payment_status==="paid"&&flow[o.status]&&<button className="primary" disabled={busy} onClick={()=>void call(async()=>{
       await api("/v1/restaurant/"+rid+"/orders/"+o.id+"/status",{method:"POST",body:JSON.stringify({status:flow[o.status]})});
       await loadRestaurant(rid);
      })}>{actionLabel[flow[o.status]]}</button>}</div></div>)}
     </section>}
    {tab==="menu"&&<section className="panel">
     <h2>Ēdienkartes kategorijas</h2>
     <p className="muted">Kategorijas tiek saglabātas katram restorānam atsevišķi. Pogas ↑ un ↓ nosaka to secību klientu ēdienkartē.</p>
     <form onSubmit={addCategory} className="fields">
      <div className="field"><label>Jauna kategorija</label>
       <input value={newCategory} onChange={e=>setNewCategory(e.target.value)}
        placeholder="Piemēram, Burgeri" minLength={2} maxLength={80} required/></div>
      <button className="primary" disabled={busy}>Saglabāt kategoriju</button>
     </form>
     {categories.length===0&&<p className="notice">Vispirms izveido kategoriju, pēc tam pievieno tajā ēdienus.</p>}
     {categories.map((c,i)=><div className="row" key={c.id}>
      <div><strong>{i+1}. {c.name}</strong>
       <small>{menu.filter(m=>m.category===c.name).length} ēdieni</small></div>
      <div className="cardActions">
       <button className="secondary" disabled={busy||i===0}
        aria-label={"Pārvietot kategoriju "+c.name+" augstāk"}
        onClick={()=>void moveCategory(c.id,"up")}>↑ Augstāk</button>
       <button className="secondary" disabled={busy||i===categories.length-1}
        aria-label={"Pārvietot kategoriju "+c.name+" zemāk"}
        onClick={()=>void moveCategory(c.id,"down")}>↓ Zemāk</button>
      </div>
     </div>)}
     <h2 style={{marginTop:32}}>Ēdieni</h2>
     <form onSubmit={addMenu} className="fields">
      <div className="field"><label>Nosaukums</label><input value={itemName} onChange={e=>setItemName(e.target.value)} required minLength={2}/></div>
      <div className="field"><label>Kategorija</label>
       <select value={itemCategory} onChange={e=>setItemCategory(e.target.value)} required>
        {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
       </select></div>
      <div className="field"><label>Cena €</label><input value={itemPrice} onChange={e=>setItemPrice(e.target.value)} inputMode="decimal" placeholder="8.90" required/></div>
      <button className="primary" disabled={busy||categories.length===0}>Pievienot ēdienu</button>
     </form>
     {[...menu].sort((a,b)=>{
       const rank=(x:string)=>categories.findIndex(c=>c.name===x);
       const ra=rank(a.category),rb=rank(b.category);
       return (ra<0?9999:ra)-(rb<0?9999:rb)||a.name.localeCompare(b.name,"lv");
     }).map(item=><div className="row" key={item.id}><div>
      <strong>{item.name}</strong> <span className="badge">{item.category}</span>
      <small>{item.description||"Bez apraksta"}</small>
     </div><div className="cardActions">
      <strong>{money(item.price_cents)}</strong>
      <select aria-label={"Kategorija: "+item.name} value={item.category}
       disabled={busy} style={{maxWidth:200}}
       onChange={e=>void call(async()=>{
        await api("/v1/restaurant/"+rid+"/menu/"+item.id,{
         method:"PATCH",body:JSON.stringify({category:e.target.value})
        });await loadRestaurant(rid);
       })}>
       {!categories.some(c=>c.name===item.category)&&<option value={item.category}>{item.category} (veca)</option>}
       {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
      </select>
      <button className="toggle" disabled={busy} onClick={()=>void call(async()=>{
       await api("/v1/restaurant/"+rid+"/menu/"+item.id,{method:"PATCH",body:JSON.stringify({available:!item.available})});
       await loadRestaurant(rid);
      })}>{item.available?"Aktīvs ✓":"Paslēpts"}</button>
      <button className="secondary" disabled={busy} onClick={()=>{
       const str=window.prompt("Jaunā cena (€)",(item.price_cents/100).toFixed(2));
       if(str===null)return;
       const cents=Math.round(Number(str.replace(",","."))*100);
       if(!Number.isFinite(cents)||cents<0){setError("Nederīga cena");return;}
       void call(async()=>{
        await api("/v1/restaurant/"+rid+"/menu/"+item.id,{method:"PATCH",body:JSON.stringify({price_cents:cents})});
        await loadRestaurant(rid);
       });
      }}>Mainīt cenu</button>
     </div></div>)}
    </section>}
    {tab==="complaints"&&<section className="panel">
      <h2>Sūdzības un daļējās atmaksas</h2>
      <p className="notice">Restorāns sniedz skaidrojumu un iesaka atmaksas summu. Tikai BaitMe operators pieņem galīgo lēmumu pēc izmeklēšanas. Stripe atmaksa NAV aktivizēta.</p>
      {complaints.length===0&&<p className="empty">Pašlaik nav sūdzību.</p>}
      {complaints.map(c=><div key={c.id} className="panel" style={{marginTop:12}}>
       <div className="row"><div><strong>Pasūtījums #{c.order_id.slice(0,8)}</strong> <span className="badge">{c.status}</span>
         <small>Kategorija: {c.category} · Pieprasītā summa: {money(c.requested_refund_cents)}</small>
         <p>{c.customer_description}</p>
       </div></div>
       {c.restaurant_response&&<div className="notice"><strong>Restorāna atbilde:</strong> {c.restaurant_response}
        <p>Ieteiktā daļējā atmaksa: {money(c.restaurant_recommended_cents||0)}</p></div>}
       {c.review_note&&<p className="muted">Izmeklēšanas lēmums: {c.review_note}</p>}
       {c.approved_refund_cents!=null&&<p className="muted">Apstiprināts: {money(c.approved_refund_cents)}. Stripe izmaksa jāizpilda atsevišķi.</p>}
       {c.status==="awaiting_restaurant"&&<form onSubmit={e=>{
         e.preventDefault();
         void call(async()=>{
          const amount=Number((recommendations[c.id]||"0").replace(",","."));
          const cents=Math.round(amount*100);
          if(!Number.isFinite(amount)||!Number.isSafeInteger(cents)||cents<0)
           throw Error("Nederīga atmaksas summa");
          await api("/v1/restaurant/"+rid+"/complaints/"+c.id+"/respond",{
           method:"POST",body:JSON.stringify({
            response:responses[c.id]||"",recommendedRefundCents:cents
           })
          });
          await loadRestaurant(rid);
         });
       }} className="fields">
        <div className="field" style={{flexBasis:"100%"}}><label>Restorāna skaidrojums (vismaz 10 simboli)</label>
         <textarea required minLength={10} rows={4} value={responses[c.id]||""}
          onChange={e=>setResponses(v=>({...v,[c.id]:e.target.value}))}/></div>
        <div className="field"><label>Ieteiktā daļējā atmaksa € (0 = atteikt)</label>
         <input required type="text" inputMode="decimal" value={recommendations[c.id]||""} placeholder="0,00"
          onChange={e=>setRecommendations(v=>({...v,[c.id]:e.target.value}))}/></div>
        <button disabled={busy} className="primary">Nosūtīt skaidrojumu izmeklēšanai</button>
       </form>}
      </div>)}
    </section>}
    {tab==="zones"&&<section className="panel">
      <h2>Restorāna atrašanās vieta</h2>
      <p className="muted">Piegādes zonas katrs restorāns nosaka pats no savas faktiskās atrašanās vietas. Precīzai konfigurācijai saglabā adresi un koordinātas (piemēram, no Google Maps, ar labo klikšķi uz restorāna).</p>
      <form onSubmit={saveLocation} className="fields">
       <div className="field" style={{flexBasis:"100%"}}><label>Restorāna adrese</label>
        <input value={pickupAddress} onChange={e=>setPickupAddress(e.target.value)}
         placeholder="Iela, numurs, pilsēta" minLength={5} maxLength={300} required/></div>
       <div className="field"><label>Platums (latitude)</label>
        <input value={pickupLat} onChange={e=>setPickupLat(e.target.value)}
         placeholder="56.9496" inputMode="decimal" required/></div>
       <div className="field"><label>Garums (longitude)</label>
        <input value={pickupLng} onChange={e=>setPickupLng(e.target.value)}
         placeholder="24.1052" inputMode="decimal" required/></div>
       <button className="primary" disabled={busy}>Saglabāt restorāna atrašanās vietu</button>
      </form>
      {location.latitude!=null&&location.longitude!=null&&<div>
       <p className="notice">Zonu centrs: {location.pickup_address} ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)})</p>
       <iframe title="Restorāna atrašanās vieta kartē" loading="lazy" style={{width:"100%",height:260,border:0,borderRadius:16}}
        src={"https://www.openstreetmap.org/export/embed.html?bbox="+
        (location.longitude-0.035)+","+(location.latitude-0.02)+","+
        (location.longitude+0.035)+","+(location.latitude+0.02)+
        "&layer=mapnik&marker="+location.latitude+","+location.longitude}/>
      </div>}
      <h2 style={{marginTop:32}}>Piegādes zonas no restorāna</h2>
      <p className="muted">Piemērs: 0–3 km par 3,50 €, 3–7 km par 5 €. Rādiusi ir taisnās līnijas attālumi, nevis brauciena maršruts. Aktīvas zonas nedrīkst pārklāties.</p>
      <form onSubmit={addZone} className="fields">
       <div className="field"><label>Zonas nosaukums</label>
        <input value={zoneName} onChange={e=>setZoneName(e.target.value)} placeholder="Centrs" required/></div>
       <div className="field"><label>No (km)</label>
        <input value={zoneMinKm} onChange={e=>setZoneMinKm(e.target.value)} inputMode="decimal" required/></div>
       <div className="field"><label>Līdz (km)</label>
        <input value={zoneMaxKm} onChange={e=>setZoneMaxKm(e.target.value)} inputMode="decimal" required/></div>
       <div className="field"><label>Piegādes maksa (€)</label>
        <input value={zonePrice} onChange={e=>setZonePrice(e.target.value)} inputMode="decimal" required/></div>
       <button className="primary" disabled={busy||location.latitude==null}>Pievienot zonu</button>
      </form>
      {zones.map(z=><div className="row" key={z.id}>
       <div><strong>{z.name}</strong>
        <small>{zoneBand(z)} · {z.active?"Aktīva":"Izslēgta"}</small></div>
       <div className="cardActions"><strong>{money(z.delivery_cents)}</strong>
        {z.zone_type==="radius"&&<>
         <button className="secondary" disabled={busy} onClick={()=>{
          const value=window.prompt("Jaunā piegādes cena (€)",(z.delivery_cents/100).toFixed(2));
          if(value===null)return;
          const cents=Math.round(Number(value.replace(",","."))*100);
          if(!Number.isSafeInteger(cents)||cents<0){setError("Nederīga piegādes cena");return;}
          void updateZone(z.id,{delivery_cents:cents});
         }}>Mainīt cenu</button>
         <button className="toggle" disabled={busy}
          onClick={()=>void updateZone(z.id,{active:!z.active})}>{z.active?"Izslēgt":"Ieslēgt"}</button>
        </>}
       </div>
      </div>)}
      <p className="notice">Piegādes zonas konfigurācija tiek saglabāta jau tagad. Klienta adreses ģeokodēšana un automātiska zonas izvēle vēl jāintegrē — līdz tam jaunajās attāluma zonās nevar izveidot apmaksājamu pasūtījumu. Tādējādi klienta paša izvēlēts attālums nevar apiet piegādes cenu.</p>
    </section>}
    </>}
   </>}
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="muted" style={{marginTop:40}}>BaitMe prototips · Reāli maksājumi un izmaksas vēl nav aktivizēti.</p>
 </main>;
}
