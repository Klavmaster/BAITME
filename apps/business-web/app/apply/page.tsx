"use client";
import {useEffect,useState} from "react";
import {createClient,type Session} from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";
const apiUrl=(process.env.NEXT_PUBLIC_API_URL||"").replace(/\/$/,"");
export default function Apply(){
 const [supabase]=useState(()=>url&&anon?createClient(url,anon):null);
 const [session,setSession]=useState<Session|null>(null);
 const [email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [kind,setKind]=useState<"restaurant"|"courier">("restaurant");
 const [name,setName]=useState(""),[slug,setSlug]=useState(""),[category,setCategory]=useState("Burgeri");
 const [description,setDescription]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{
  if(!supabase)return;
  void supabase.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return ()=>subscription.unsubscribe();
 },[supabase]);
 async function perform(fn:()=>Promise<void>){
  setBusy(true);setError("");setMessage("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Kļūda");}
  finally{setBusy(false);}
 }
 async function authorize(mode:"in"|"up"){
  await perform(async()=>{
   if(!supabase)throw Error("Trūkst Supabase konfigurācijas");
   const result=mode==="in"?await supabase.auth.signInWithPassword({email,password})
    :await supabase.auth.signUp({email,password});
   if(result.error)throw Error("Autorizācijas kļūda");
   if(mode==="up"&&!result.data.session)setMessage("Pārbaudi e-pastu un apstiprini kontu.");
  });
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();
  await perform(async()=>{
   const token=(await supabase?.auth.getSession())?.data.session?.access_token;
   if(!token)throw Error("Vispirms pieslēdzies");
   const body=kind==="restaurant"?{name,slug,category,description}:{displayName:name};
   const response=await fetch(apiUrl+"/v1/apply/"+kind,{method:"POST",headers:{
    Authorization:"Bearer "+token,"Content-Type":"application/json"
   },body:JSON.stringify(body)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Neizdevās iesniegt");
   setMessage("Pieteikums saņemts! Statuss: pending. Operators to pārskatīs.");
  });
 }
 return <main>
  <header className="top"><div className="brand">bait<span>me.</span><div className="eyebrow">Pievienoties BaitMe</div></div>
    <a className="secondary" href="/">Restorānu panelis</a></header>
  <h1>Strādā kopā ar BaitMe</h1>
  <p className="muted">0 € abonements, 0% komisija. Uzņēmumi un kurjeri jāapstiprina pirms darba.</p>
  {!url||!anon||!apiUrl?<p className="error">Trūkst Supabase/API konfigurācijas.</p>:!session?
  <section className="panel" style={{maxWidth:560}}>
   <h2>Izveido kontu vai pieslēdzies</h2>
   <div className="fields">
    <div className="field"><label>E-pasts</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
    <div className="field"><label>Parole (vismaz 8 simboli)</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div>
   </div><div className="cardActions">
     <button className="primary" disabled={busy} onClick={()=>void authorize("in")}>Ieiet</button>
     <button className="secondary" disabled={busy} onClick={()=>void authorize("up")}>Reģistrēties</button>
   </div>
  </section>:<section className="panel" style={{maxWidth:690}}>
   <h2>Pieteikuma forma</h2>
   <div className="tabs">
    <button className={"tab "+(kind==="restaurant"?"active":"")} onClick={()=>setKind("restaurant")}>Restorāns</button>
    <button className={"tab "+(kind==="courier"?"active":"")} onClick={()=>setKind("courier")}>Kurjers</button>
   </div><form onSubmit={submit}>
    <div className="fields">
     <div className="field"><label>{kind==="restaurant"?"Restorāna nosaukums":"Kurjera vārds"}</label>
      <input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={120} required/></div>
     {kind==="restaurant"&&<>
      <div className="field"><label>Restorāna īsais kods (a-z, 0-9, -)</label>
       <input value={slug} onChange={e=>setSlug(e.target.value)} pattern="[a-z0-9-]{3,60}" required/></div>
      <div className="field"><label>Kategorija</label>
       <input value={category} onChange={e=>setCategory(e.target.value)} required/></div>
      <div className="field"><label>Apraksts</label>
       <input value={description} onChange={e=>setDescription(e.target.value)}/></div>
     </>}
    </div><button className="primary" disabled={busy}>Iesniegt pieteikumu</button>
   </form>
   <p className="muted">Apstiprinājums vēl nenozīmē, ka uzņēmums ir publicēts vai kurjers drīkst veikt piegādes. Vajadzīga dokumentu un maksājumu saņēmēja pārbaude.</p>
   <button className="secondary" onClick={()=>void supabase?.auth.signOut()}>Iziet no konta</button>
  </section>}
  {!!error&&<p className="error" role="alert">{error}</p>}
  {!!message&&<p className="notice">{message}</p>}
 </main>;
}
