"use client";
import {useEffect,useState} from "react";
import {createClient,type Session} from "@supabase/supabase-js";
type RestaurantApplication={id:string;name:string;slug:string;category:string;description:string;created_at:string};
type CourierApplication={id:string;display_name:string;created_at:string};
type Complaint={id:string;order_id:string;restaurant_id:string;category:string;customer_description:string;
 requested_refund_cents:number;status:string;restaurant_response:string|null;restaurant_recommended_cents:number|null;
 approved_refund_cents:number|null;created_at:string};
const money=(c:number)=>(c/100).toFixed(2).replace(".",",")+" €";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";
const apiUrl=(process.env.NEXT_PUBLIC_API_URL||"").replace(/\/$/,"");
export default function Admin(){
 const [supabase]=useState(()=>url&&anon?createClient(url,anon):null);
 const [session,setSession]=useState<Session|null>(null);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [restaurants,setRestaurants]=useState<RestaurantApplication[]>([]);
 const [couriers,setCouriers]=useState<CourierApplication[]>([]);
 const [complaints,setComplaints]=useState<Complaint[]>([]);
 const [decisionNotes,setDecisionNotes]=useState<Record<string,string>>({});
 const [decisionAmounts,setDecisionAmounts]=useState<Record<string,string>>({});
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!supabase)return;
  void supabase.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[supabase]);
 async function api(path:string,init?:RequestInit){
  const token=(await supabase?.auth.getSession())?.data.session?.access_token;
  if(!token)throw Error("Nepieciešama pieslēgšanās");
  const response=await fetch(apiUrl+path,{
   ...init,headers:{Authorization:"Bearer "+token,...(init?.body?{"Content-Type":"application/json"}:{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"API kļūda");
  return data;
 }
 async function perform(fn:()=>Promise<void>){
  setBusy(true);setError("");setMessage("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Kļūda");}
  finally{setBusy(false);}
 }
 async function reload(){
  const [r,c]=await Promise.all([api("/v1/admin/applications"),api("/v1/admin/complaints")]);
  setRestaurants(r.restaurants);setCouriers(r.couriers);setComplaints(c.complaints);
 }
 useEffect(()=>{if(session)void perform(reload);},[session?.user.id]);
 async function approve(kind:"restaurant"|"courier",id:string){
  await perform(async()=>{
   if(!window.confirm("Apstiprināt pieteikumu? Tas vēl NEAKTIVIZĒ maksājumus, restorāna publikāciju vai kurjera darbu."))return;
   await api("/v1/admin/applications/"+kind+"/"+id+"/approve",{method:"POST"});
   setMessage("Pieteikums apstiprināts. Pabeidz manuālo verifikāciju.");
   await reload();
  });
 }
 async function reviewComplaint(id:string,approve:boolean,requestedCents:number){
  await perform(async()=>{
   if(!window.confirm(approve
     ?"Apstiprināt DAĻĒJO atmaksu tikai izpildes rindā? Nauda vēl NETIEK atgriezta.":"Noraidīt šo sūdzību?"))return;
   const amountStr=decisionAmounts[id]||String(requestedCents/100);
   const amount=Number(amountStr.replace(",","."));
   const cents=Math.round(amount*100);
   if(approve&&(!Number.isFinite(amount)||!Number.isSafeInteger(cents)||cents<1))
     throw Error("Nepareiza atmaksas summa");
   await api("/v1/admin/complaints/"+id+"/review",{
     method:"POST",body:JSON.stringify({
      approve,approvedRefundCents:approve?cents:null,note:decisionNotes[id]||""
     })
   });
   await reload();
   setMessage(approve?"Lēmums apstiprināts, bet Stripe atmaksa NAV veikta.":"Sūdzība noraidīta.");
  });
 }
 async function login(e:React.FormEvent){
  e.preventDefault();
  await perform(async()=>{
   if(!supabase)throw Error("Trūkst Supabase konfigurācijas");
   const {error:e}=await supabase.auth.signInWithPassword({email,password});
   if(e)throw Error("Pieteikšanās neizdevās");
  });
 }
 return <main>
  <header className="top"><div className="brand">bait<span>me.</span><div className="eyebrow">Platformas operators</div></div>
   <a className="secondary" href="/">Biznesa panelis</a></header>
  <p className="eyebrow">Operatora vide</p><h1>Pieteikumi un sūdzību izmeklēšana</h1>
  <p className="notice">Tikai platform_admins lomai. Apstiprinājums neaktivizē reālu naudu vai kurjera piegādes.</p>
  {!url||!anon||!apiUrl?<p className="error">Trūkst API vai Supabase konfigurācijas.</p>:!session?
  <form onSubmit={login} className="panel" style={{maxWidth:500}}>
    <h2>Administratora piekļuve</h2><div className="fields">
     <div className="field"><label>E-pasts</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></div>
     <div className="field"><label>Parole</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></div>
    </div><button disabled={busy} className="primary">Ieiet</button>
  </form>:<>
   <div className="tabs"><button disabled={busy} className="secondary" onClick={()=>void perform(reload)}>Atjaunot pieteikumus</button>
     <button className="secondary" onClick={()=>void supabase?.auth.signOut()}>Iziet</button></div>
   <section className="panel"><h2>Restorānu pieteikumi ({restaurants.length})</h2>
    {restaurants.length===0&&<p className="muted">Nav jaunu pieteikumu.</p>}
    {restaurants.map(r=><div key={r.id} className="row"><div>
     <strong>{r.name}</strong> <span className="badge">{r.category}</span>
     <small>{r.slug} · {r.description} · {new Date(r.created_at).toLocaleDateString("lv-LV")}</small>
    </div><button disabled={busy} className="primary" onClick={()=>void approve("restaurant",r.id)}>Apstiprināt (nepublicēt)</button></div>)}
   </section>
   <section className="panel"><h2>Kurjeru pieteikumi ({couriers.length})</h2>
    {couriers.length===0&&<p className="muted">Nav jaunu pieteikumu.</p>}
    {couriers.map(c=><div key={c.id} className="row"><div>
      <strong>{c.display_name}</strong><small>{new Date(c.created_at).toLocaleDateString("lv-LV")}</small>
    </div><button disabled={busy} className="primary" onClick={()=>void approve("courier",c.id)}>Apstiprināt (neaktivizēt)</button></div>)}
   </section>
   <section className="panel">
    <h2>Sūdzības / Compliance ({complaints.length})</h2>
    <p className="notice">Restorāna ieteikums nav atmaksas apstiprinājums. Operators pieņem lēmumu; Stripe izpilde vēl nav pieslēgta. Parasti pēc īstas refund uzsākšanas: 5–10 darba dienas, var būt ilgāk.</p>
    {complaints.length===0&&<p className="muted">Nav jaunu sūdzību.</p>}
    {complaints.map(c=><div key={c.id} className="panel">
     <strong>#{c.order_id.slice(0,8)} · {c.category}</strong> <span className="badge">{c.status}</span>
     <p className="muted">{c.customer_description}</p>
     <p>Klienta prasība: <strong>{money(c.requested_refund_cents)}</strong></p>
     {c.restaurant_response&&<><p><strong>Restorāna atbilde:</strong> {c.restaurant_response}</p>
      <p>Restorāna ieteikums: <strong>{money(c.restaurant_recommended_cents||0)}</strong></p></>}
     {c.status==="under_review"&&<div className="fields">
       <div className="field" style={{flexBasis:"100%"}}>
        <label>Izmeklēšanas pamatojums (vismaz 10 simboli)</label>
        <textarea required rows={3} value={decisionNotes[c.id]||""}
         onChange={e=>setDecisionNotes(v=>({...v,[c.id]:e.target.value}))}/>
       </div>
       <div className="field"><label>Atmaksas summa €</label><input type="text" inputMode="decimal"
         placeholder={(c.requested_refund_cents/100).toFixed(2)} value={decisionAmounts[c.id]||""}
         onChange={e=>setDecisionAmounts(v=>({...v,[c.id]:e.target.value}))}/></div>
       <button className="primary" disabled={busy||(decisionNotes[c.id]||"").trim().length<10}
        onClick={()=>void reviewComplaint(c.id,true,c.requested_refund_cents)}>Apstiprināt daļējo atmaksu (bez Stripe izpildes)</button>
       <button className="secondary" disabled={busy||(decisionNotes[c.id]||"").trim().length<10}
        onClick={()=>void reviewComplaint(c.id,false,c.requested_refund_cents)}>Noraidīt</button>
     </div>}
     {c.status==="awaiting_restaurant"&&<p className="muted">Gaidām restorāna skaidrojumu.</p>}
     {c.status==="approved_pending_refund"&&<p className="error">Lēmums ir pieņemts, taču Stripe refund NAV izpildīts. Droša izmaksu plūsma jāievieš atsevišķi.</p>}
    </div>)}
   </section>
  </>}
  {!!error&&<p className="error" role="alert">{error}</p>}
  {!!message&&<p className="notice">{message}</p>}
 </main>;
}
