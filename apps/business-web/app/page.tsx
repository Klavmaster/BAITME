"use client";
import {useEffect,useMemo,useState} from "react";
import {BusinessSidebar,BusinessHeader,VenueSwitcher,BizIcon,viewText,type BusinessView} from "./business-chrome";
import "./business.css";
import {createClient,type SupabaseClient,type Session} from "@supabase/supabase-js";
type Restaurant={id:string;name:string;role:string;published:boolean;slug:string};
type Menu={id:string;name:string;description:string;category:string;price_cents:number;available:boolean};
type Category={id:string;name:string;sort_order:number};
type Zone={id:string;name:string;zone_type:"postal_prefix"|"radius";postal_code_prefix:string|null;min_distance_m:number|null;max_distance_m:number|null;delivery_cents:number;active:boolean};
type Location={pickup_address:string|null;latitude:number|null;longitude:number|null};
type Order={id:string;created_at:string;status:string;payment_status:string;food_cents:number;restaurant_processing_fee_cents:number;platform_fee_cents:number;delivery_cents:number;total_cents:number;address_line:string;postal_code:string;order_items:{name:string;quantity:number}[]};
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

function statusText(v:string):string{
 return ({awaiting_payment:"Gaida apmaksu",placed:"Jauns",accepted:"Pieņemts",preparing:"Gatavošanā",
  ready_for_pickup:"Gatavs",picked_up:"Ceļā",delivered:"Piegādāts",cancelled:"Atcelts"} as Record<string,string>)[v]||v;
}
function statusTone(v:string):string{
 return ["delivered"].includes(v)?"is-success":v==="cancelled"?"is-danger":
  ["placed","accepted","preparing","ready_for_pickup","picked_up"].includes(v)?"is-warning":"is-neutral";
}
export default function Page(){
 const [client]=useState<SupabaseClient|null>(()=>configured?createClient(URL,KEY):null);
 const [session,setSession]=useState<Session|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [restaurants,setRestaurants]=useState<Restaurant[]>([]),[rid,setRid]=useState("");
 const [tab,setTab]=useState<BusinessView>("home");
 const [venueDialog,setVenueDialog]=useState(false),[mobileNav,setMobileNav]=useState(false);
 const [orderFilter,setOrderFilter]=useState<"all"|"active"|"delivered"|"cancelled">("all");
 const [orderSearch,setOrderSearch]=useState("");
 const [dateRange,setDateRange]=useState<"today"|"yesterday"|"week">("week");
 const [addItemOpen,setAddItemOpen]=useState(false),[itemDescription,setItemDescription]=useState("");
 useEffect(()=>{
  const sync=()=>{const hash=window.location.hash.slice(1);if(hash in viewText)setTab(hash as BusinessView);};
  sync();window.addEventListener("hashchange",sync);return ()=>window.removeEventListener("hashchange",sync);
 },[]);
 function navigate(v:BusinessView){
  setTab(v);window.history.replaceState(null,"",window.location.pathname+window.location.search+"#"+v);
 }
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
 const paidOrders=useMemo(()=>orders.filter(o=>["paid","partially_refunded"].includes(o.payment_status)),[orders]);
 const filteredOrders=useMemo(()=>orders.filter(o=>{
  const active=["placed","accepted","preparing","ready_for_pickup","picked_up"].includes(o.status);
  const matches=orderFilter==="all"||
   (orderFilter==="active"&&active)||(orderFilter==="delivered"&&o.status==="delivered")||
   (orderFilter==="cancelled"&&o.status==="cancelled");
  const q=orderSearch.trim().toLocaleLowerCase("lv");
  return matches&&(!q||(o.id+" "+o.order_items?.map(i=>i.name).join(" ")).toLocaleLowerCase("lv").includes(q));
 }),[orders,orderFilter,orderSearch]);
 const salesDays=useMemo(()=>{
  const key=(date:Date)=>date.toLocaleDateString("sv-SE",{timeZone:"Europe/Riga"});
  const today=new Date();
  return Array.from({length:7},(_,i)=>{
   const day=new Date(today.getTime()-(6-i)*86400000),dateKey=key(day);
   const cents=paidOrders.filter(o=>key(new Date(o.created_at))===dateKey).reduce((n,o)=>n+o.food_cents,0);
   return {key:dateKey,label:day.toLocaleDateString("lv-LV",{timeZone:"Europe/Riga",month:"short",day:"numeric"}),cents};
  });
 },[paidOrders]);
 const periodSales=useMemo(()=>{
  const days=dateRange==="today"?salesDays.slice(-1):dateRange==="yesterday"?salesDays.slice(-2,-1):salesDays;
  return days.reduce((sum,d)=>sum+d.cents,0);
 },[dateRange,salesDays]);
 const chartMax=Math.max(...salesDays.map(d=>d.cents),100);
 const activeCount=orders.filter(o=>["placed","accepted","preparing","ready_for_pickup","picked_up"].includes(o.status)).length;
 const deliveredCount=orders.filter(o=>o.status==="delivered").length;
 const complaintOpen=complaints.filter(c=>!["rejected","refunded","refund_submitted"].includes(c.status)).length;
 async function selectVenue(id:string){
  if(id===rid)return;
  await call(async()=>{await loadRestaurant(id);setRid(id);});
 }
 function exportOrders(){
  // CSV contains only the loaded rows (API limit 100), never unbounded exports.
  // Formula-like cell values are neutralized to prevent spreadsheet injection.
  const safe=(v:unknown)=>{
   const value=String(v??"");
   const neutral=/^\s*[=+@-]/.test(value)?"'"+value:value;
   return '"'+neutral.replaceAll('"','""')+'"';
  };
  const rows=[
   ["ID","Datums","Statuss","Maksājums","Ēdiens EUR","Piegāde EUR","BaitMe EUR","Kopā EUR"],
   ...filteredOrders.map(o=>[o.id,o.created_at,o.status,o.payment_status,
    (o.food_cents/100).toFixed(2),(o.delivery_cents/100).toFixed(2),
    (o.platform_fee_cents/100).toFixed(2),(o.total_cents/100).toFixed(2)])
  ];
  const blob=new Blob(["\uFEFF"+rows.map(row=>row.map(safe).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const link=window.URL.createObjectURL(blob),a=document.createElement("a");
  a.href=link;a.download="baitme-pasutijumi-"+(current?.slug||"restorans")+".csv";
  document.body.appendChild(a);a.click();a.remove();window.URL.revokeObjectURL(link);
 }
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
    name:itemName,description:itemDescription,category:itemCategory,priceCents:cents
   })});
   setItemName("");setItemPrice("");setItemDescription("");setAddItemOpen(false);await loadRestaurant(rid);
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
  <p className="notice">Trūkst publiskās Supabase/API konfigurācijas.</p></main>;
 if(!ready)return <main><h1>BaitMe Business</h1><p>Ielādē...</p></main>;
 return <div className="biz-app">
 {!session?<main className="biz-auth-page">
  <section className="biz-auth-card">
   <div className="biz-auth-brand">bait<span>me.</span><small> BUSINESS</small></div>
   <p className="biz-eyebrow">Restorānu pārvaldība</p>
   <h1>Laipni lūdzam atpakaļ!</h1>
   <p className="muted">Pieslēdzies BaitMe, lai pārvaldītu savus restorānus, pasūtījumus un ēdienkartes.</p>
   <form onSubmit={e=>{e.preventDefault();void login();}} className="biz-login-fields">
    <label>E-pasts<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required/></label>
    <label>Parole<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required/></label>
    <button className="primary" disabled={busy}>Ieiet biznesa panelī</button>
   </form>
   {error&&<div className="error" role="alert">{error}</div>}
   <p className="muted">Vēl neesi partneris? <a href="/apply">Pieteikt restorānu</a></p>
  </section>
 </main>:<>
  <BusinessSidebar view={tab} onNavigate={navigate} venueName={current?.name||""}
   email={session.user.email||""} onSwitch={()=>setVenueDialog(true)}
   onSignOut={()=>void client?.auth.signOut()}
   mobileOpen={mobileNav} onCloseMobile={()=>setMobileNav(false)}/>
  <div className="biz-workspace">
   <BusinessHeader view={tab} venueName={current?.name||""}
    onOpenSwitcher={()=>setVenueDialog(true)} onOpenMobile={()=>setMobileNav(true)}
    loading={busy} onRefresh={()=>{if(rid)void call(()=>loadRestaurant(rid))}}/>
   <main className="biz-content">
    <div className="biz-page-heading">
     <div><p className="biz-eyebrow">BaitMe / Restorāna vadība</p><h1>{viewText[tab].title}</h1>
      <p className="muted">{viewText[tab].subtitle}</p></div>
     <div className="biz-heading-actions">
      {current&&<span className={"biz-visibility "+(current.published?"is-published":"")}>
       <span className="biz-status-dot"/>{current.published?"Publicēts":"Nav publicēts"}</span>}
      <button className="secondary" disabled={busy||!rid} onClick={()=>{if(rid)void call(()=>loadRestaurant(rid))}}>
       <BizIcon name="refresh" size={17}/> Atjaunot</button>
     </div>
    </div>
    {error&&<div className="error" role="alert">{error}<button className="biz-dismiss" aria-label="Aizvērt kļūdu" onClick={()=>setError("")}>×</button></div>}
    {!restaurants.length&&<section className="biz-card biz-empty-onboarding">
      <h2>Nav piesaistītu restorānu</h2><p className="muted">Pievieno savu restorānu vai gaidi administratora apstiprinājumu.</p>
      <a href="/apply" className="primary biz-inline-link"><BizIcon name="plus" size={16}/> Pieteikt restorānu</a>
     </section>}
    {current&&<>{tab==="home"&&<>
 <div className="biz-stats-row">
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Pasūtījumi kopā</span>
   <strong>{summary.totalOrders}</strong><small>{summary.paidOrders} apmaksas statusā</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Aktīvie pasūtījumi</span>
   <strong>{activeCount}</strong><small>Vēl nav pabeigti</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Piegādāti</span>
   <strong>{deliveredCount}</strong><small>No pēdējiem {orders.length} pasūtījumiem</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Atvērtas sūdzības</span>
   <strong>{complaintOpen}</strong><small>{complaints.length} ieraksti kopā</small></div>
 </div>
 <div className="biz-dashboard-grid">
  <section className="biz-card biz-venue-overview">
   <div className="biz-card-head"><div><h2>Tavas lokācijas</h2><p className="muted">Pārvaldi katru restorānu atsevišķi</p></div>
    <button className="biz-icon-button" aria-label="Mainīt lokāciju" onClick={()=>setVenueDialog(true)}><BizIcon name="switch"/></button></div>
   <div className="biz-overview-filters"><span className="biz-filter-selected">Visi ({restaurants.length})</span>
    <span>Publicēti ({restaurants.filter(r=>r.published).length})</span>
    <span>Nepublicēti ({restaurants.filter(r=>!r.published).length})</span></div>
   <div className="biz-overview-list">
    {restaurants.map(r=><button className="biz-overview-row" key={r.id} onClick={()=>void selectVenue(r.id)}>
     <span className="biz-overview-avatar">{r.name.slice(0,2).toUpperCase()}</span>
     <span className="biz-overview-name"><strong>{r.name}</strong><small>{r.slug}</small></span>
     <span className={"biz-online-dot "+(r.published?"online":"offline")}/>
     <span className="biz-overview-status">{r.published?"Publicēts":"Nav publicēts"}</span>
    </button>)}
   </div>
   <div className="biz-card-footer"><button className="biz-link" onClick={()=>setVenueDialog(true)}>Pārslēgt lokāciju →</button></div>
  </section>
  <section className="biz-card biz-sales-overview">
   <div className="biz-card-head"><div><h2>Pārdošanas pārskats</h2><p className="muted">Ēdiena summa no ielādētajiem pasūtījumiem</p></div>
    <button className="biz-icon-button" aria-label="Atvērt analītiku" onClick={()=>navigate("insights")}><BizIcon name="external"/></button></div>
   <div className="biz-period-control" aria-label="Periods">
    {([["today","Šodien"],["yesterday","Vakar"],["week","7 dienas"]] as const).map(([v,label])=>
     <button key={v} className={dateRange===v?"chosen":""} onClick={()=>setDateRange(v)}>{label}</button>)}</div>
   <strong className="biz-sales-total">{money(periodSales)}</strong>
   <div className="biz-bars" role="img" aria-label="Pārdošana pēdējās septiņās dienās">
    {salesDays.map(day=><div className="biz-bar-column" key={day.key} title={day.key+": "+money(day.cents)}>
      <span className="biz-bar-track"><span style={{height:Math.max(day.cents>0?8:2,day.cents/chartMax*100)+"%"}}/></span>
      <small>{day.label}</small></div>)}</div>
   <p className="biz-fineprint">Tikai ielādētie pasūtījumi (līdz 100) bez atmaksu korekcijām. Nav grāmatvedības pārskats.</p>
  </section>
 </div>
 <div className="biz-dashboard-grid biz-lower-grid">
  <section className="biz-card">
   <div className="biz-card-head"><h2>Jaunākie pasūtījumi</h2><button className="biz-link" onClick={()=>navigate("orders")}>Visi pasūtījumi →</button></div>
   {!orders.length?<div className="biz-empty">Pasūtījumu vēl nav. Tie parādīsies pēc klientu aktivitātes.</div>:
    orders.slice(0,5).map(o=><div className="biz-activity-row" key={o.id}>
     <span className="biz-activity-icon"><BizIcon name="orders" size={17}/></span>
     <span><strong>#{o.id.slice(0,8)}</strong><small>{new Date(o.created_at).toLocaleString("lv-LV")}</small></span>
     <span className={"biz-status-pill "+statusTone(o.status)}>{statusText(o.status)}</span>
     <strong>{money(o.total_cents)}</strong></div>)}
  </section>
  <section className="biz-card">
   <div className="biz-card-head"><h2>Ātrās darbības</h2></div>
   <div className="biz-quick-actions">
    <button onClick={()=>navigate("menu")}><BizIcon name="menu"/> Rediģēt ēdienkarti <span>→</span></button>
    <button onClick={()=>navigate("zones")}><BizIcon name="zones"/> Piegādes zonas <span>→</span></button>
    <button onClick={()=>navigate("complaints")}><BizIcon name="complaints"/> Sūdzības un atmaksas <span>→</span></button>
    <button onClick={()=>navigate("details")}><BizIcon name="details"/> Restorāna dati <span>→</span></button>
   </div>
   <div className="biz-info-note">BaitMe maksa restorānam: <strong>0,50 €</strong> par pabeigtu, apmaksātu pasūtījumu. Stripe maksājumi vēl izslēgti.</div>
  </section>
 </div>
 </>}{tab==="orders"&&<section className="biz-card biz-table-card">
 <div className="biz-card-head"><div><h2>Pasūtījumu vēsture</h2><p className="muted">Pēdējie līdz 100 pasūtījumiem izvēlētajā restorānā</p></div>
  <button className="secondary" onClick={exportOrders}><BizIcon name="reports" size={16}/> Eksportēt CSV</button></div>
 <div className="biz-table-tools">
  <div className="biz-filter-pills">
   {([["all","Visi"],["active","Aktīvie"],["delivered","Piegādāti"],["cancelled","Atceltie"]] as const).map(([v,label])=>
    <button key={v} className={orderFilter===v?"chosen":""} onClick={()=>setOrderFilter(v)}>{label}</button>)}</div>
  <label className="biz-table-search"><BizIcon name="search" size={17}/>
   <input placeholder="Meklēt pēc pasūtījuma vai ēdiena..." value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/></label>
 </div>
 <div className="biz-table-scroll"><table className="biz-orders-table">
  <thead><tr><th>Datums</th><th>Pasūtījums</th><th>Ēdieni</th><th>Statuss</th><th>Apmaksa</th><th>Summa</th><th>Darbība</th></tr></thead>
  <tbody>{filteredOrders.map(o=><tr key={o.id}>
   <td><strong>{new Date(o.created_at).toLocaleDateString("lv-LV")}</strong><small>{new Date(o.created_at).toLocaleTimeString("lv-LV",{hour:"2-digit",minute:"2-digit"})}</small></td>
   <td className="biz-order-id">#{o.id.slice(0,8)}</td>
   <td><span className="biz-order-items">{o.order_items?.map(i=>i.quantity+" × "+i.name).join(", ")||"—"}</span><small>{o.postal_code}</small></td>
   <td><span className={"biz-status-pill "+statusTone(o.status)}>{statusText(o.status)}</span></td>
   <td><span className={"biz-status-pill "+(o.payment_status==="paid"?"is-success":"is-neutral")}>{o.payment_status==="paid"?"Apmaksāts":o.payment_status==="unpaid"?"Neapmaksāts":o.payment_status}</span></td>
   <td className="biz-order-total">{money(o.total_cents)}</td>
   <td>{o.payment_status==="paid"&&flow[o.status]?<button className="biz-mini-action" disabled={busy} onClick={()=>void call(async()=>{
    await api("/v1/restaurant/"+rid+"/orders/"+o.id+"/status",{method:"POST",body:JSON.stringify({status:flow[o.status]})});await loadRestaurant(rid);
   })}>{actionLabel[flow[o.status]]}</button>:<span className="biz-muted-dash">—</span>}</td>
  </tr>)}</tbody>
 </table></div>
 {!filteredOrders.length&&<div className="biz-empty">Šim filtram nav atbilstošu pasūtījumu.</div>}
 </section>}{tab==="insights"&&<>
 <div className="biz-stats-row">
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Ēdienu apgrozījums (apmaksāts)</span><strong>{money(summary.foodCents)}</strong><small>Izvēlētā restorāna ielādētie dati</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Apmaksātie pasūtījumi</span><strong>{summary.paidOrders}</strong><small>No pēdējiem 2000 ierakstiem</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Vidējā apmaksātā ēdiena vērtība</span><strong>{money(summary.paidOrders?Math.round(summary.foodCents/summary.paidOrders):0)}</strong><small>Bez piegādes maksas</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Piegādāti</span><strong>{deliveredCount}</strong><small>No pēdējiem {orders.length} pasūtījumiem</small></div>
 </div>
 <section className="biz-card"><div className="biz-card-head"><h2>7 dienu aktivitāte</h2><span className="biz-badge-neutral">Testēšanas vide</span></div>
 <div className="biz-bars biz-bars-wide">{salesDays.map(day=><div className="biz-bar-column" key={day.key}>
  <span className="biz-bar-track"><span style={{height:Math.max(day.cents?8:2,day.cents/chartMax*100)+"%"}}/></span>
  <small>{day.label}</small><small>{money(day.cents)}</small></div>)}</div>
 <p className="muted">Šis grafiks izmanto līdz 100 pēdējos pasūtījumus un ēdiena summas. Pilnvērtīgs analītikas API ar periodu atlasi un pilnu vēsturi tiks izstrādāts atsevišķi.</p></section>
 </>}{tab==="reports"&&<>
 <div className="biz-stats-row">
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Apmaksātais ēdiens</span><strong>{money(summary.foodCents)}</strong><small>No ielādētajiem ierakstiem</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Stripe apstrāde</span><strong>{money(summary.processorCents)}</strong><small>Provizoriska uzskaite</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">BaitMe maksa</span><strong>{money(summary.baitmePlatformFeeCents)}</strong><small>0,50 € par pabeigtu pasūtījumu</small></div>
  <div className="biz-card biz-stat-card"><span className="biz-stat-label">Restorāna provizoriskie ieņēmumi</span><strong>{money(summary.netRestaurantCents)}</strong><small>Pirms atmaksām un nodokļu korekcijām</small></div>
 </div>
 <section className="biz-card"><div className="biz-card-head"><h2>Norēķinu statuss</h2><span className="biz-status-pill is-warning">Testa vide</span></div>
  <p className="muted">BaitMe vēl nav pieslēgti reālie Stripe Connect pārskaitījumi, izmaksu salīdzināšana un atmaksu izpilde. Rādītās summas ir uzskaites aprēķini, nevis pārskaitīta nauda.</p>
  <button className="secondary" onClick={()=>navigate("orders")}>Skatīt pasūtījumus</button>
 </section></>}{tab==="details"&&<div className="biz-dashboard-grid">
 <section className="biz-card biz-detail-card">
  <div className="biz-card-head"><h2>Restorāna informācija</h2><span className="biz-badge-neutral">{current.role}</span></div>
  <dl className="biz-detail-list"><div><dt>Nosaukums</dt><dd>{current.name}</dd></div>
   <div><dt>Restorāna kods</dt><dd>{current.slug}</dd></div>
   <div><dt>Redzamība klientiem</dt><dd>{current.published?"Publicēts":"Nav publicēts"}</dd></div>
   <div><dt>Piegādes adrese</dt><dd>{location.pickup_address||"Nav ievadīta"}</dd></div>
   <div><dt>Ģeogrāfiskās koordinātas</dt><dd>{location.latitude==null||location.longitude==null?"Nav ievadītas":location.latitude+", "+location.longitude}</dd></div>
   <div><dt>Aktīvās piegādes zonas</dt><dd>{zones.filter(z=>z.active).length}</dd></div>
   <div><dt>Ēdienkartes kategorijas</dt><dd>{categories.length}</dd></div></dl>
  <button className="primary" onClick={()=>navigate("zones")}>Labot atrašanās vietu</button>
 </section>
 <section className="biz-card biz-detail-card"><h2>Par lokāciju pārvaldību</h2>
  <p className="muted">Katram restorānam ir sava ēdienkarte, darba lokācijas koordinātas, piegādes zonas, pasūtījumi un pārskati.</p>
  <p className="biz-info-note">Pirms restorāna publicēšanas nepieciešama uzņēmuma datu un maksājumu saņēmēja verifikācija. Publicēšana pašlaik netiek veikta automātiski.</p>
  <a href="/apply" className="secondary biz-inline-link"><BizIcon name="plus" size={16}/> Pieteikt citu restorānu</a>
 </section></div>}    {tab==="menu"&&<section className="panel">
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
     <div className="biz-section-actions"><button className="primary" onClick={()=>setAddItemOpen(true)} disabled={busy||!categories.length}>
      <BizIcon name="plus" size={17}/> Pievienot ēdienu
     </button></div>
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
      <p className="notice">Piegādes zonas ir saglabātas katram restorānam atsevišķi. Klienta adreses ģeokodēšana vēl nav ieviesta, tādēļ jaunās attāluma zonas nav pasūtāmas. Maksājumi joprojām ir izslēgti.</p>
     </section>}
    </>}
   </main>
  </div>
  <VenueSwitcher open={venueDialog} onClose={()=>setVenueDialog(false)} venues={restaurants}
   currentId={rid} onSelect={id=>void selectVenue(id)}/>
 </>}
 {session&&addItemOpen&&<div className="biz-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAddItemOpen(false)}}>
  <section className="biz-modal biz-item-modal" role="dialog" aria-modal="true" aria-label="Pievienot ēdienu">
   <div className="biz-modal-heading"><div><p className="biz-eyebrow">Ēdienkartes redaktors</p><h2>Pievienot ēdienu</h2></div>
    <button className="biz-icon-button" onClick={()=>setAddItemOpen(false)} aria-label="Aizvērt">×</button></div>
   <form onSubmit={addMenu} className="biz-item-form">
    <label>Ēdiena nosaukums<input value={itemName} onChange={e=>setItemName(e.target.value)} minLength={2} maxLength={100} placeholder="Piemēram, Liellopa burgers" required/></label>
    <label>Apraksts<textarea value={itemDescription} onChange={e=>setItemDescription(e.target.value)} maxLength={500} rows={3} placeholder="Sastāvdaļas un īss apraksts"/></label>
    <div className="biz-form-duo">
     <label>Kategorija<select value={itemCategory} onChange={e=>setItemCategory(e.target.value)} required>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
     <label>Cena (€)<input value={itemPrice} onChange={e=>setItemPrice(e.target.value)} inputMode="decimal" placeholder="8,90" required/></label>
    </div>
    <div className="biz-item-photo"><BizIcon name="menu" size={23}/><span><strong>Produkta attēls</strong><small>Attēlu augšupielādei vēl jāpieslēdz droša failu glabātuve. Esošu ēdienu attēli paliek saglabāti.</small></span></div>
    <div className="biz-modal-actions"><button type="button" className="secondary" onClick={()=>setAddItemOpen(false)}>Atcelt</button>
     <button type="submit" disabled={busy||!categories.length} className="primary">Saglabāt ēdienu</button></div>
   </form>
  </section></div>}
 </div>;
}