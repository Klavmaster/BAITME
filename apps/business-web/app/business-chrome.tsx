"use client";

import {useEffect,useState} from "react";

export type BusinessView =
 "home"|"orders"|"insights"|"menu"|"zones"|"complaints"|"reports"|"details";
export type VenueOption = {id:string;name:string;published:boolean;slug:string;role:string};
type IconName="home"|"orders"|"insights"|"menu"|"zones"|"complaints"|"reports"|"details"|"switch"|"chevron"|"logout"|"menuOpen"|"refresh"|"external"|"search"|"plus"|"close";
const icons:Record<IconName,string>={
 home:"M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z",
 orders:"M5 3h14v18l-3-2-4 2-4-2-3 2z M9 8h6 M9 12h6",
 insights:"M4 20V12m5 8V8m5 12V4m5 16v-9",
 menu:"M3 5h18M3 10h18M3 15h12M3 20h12",
 zones:"M12 22s8-5.3 8-12a8 8 0 1 0-16 0c0 6.7 8 12 8 12z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
 complaints:"M12 9v4m0 4h.01M4 4h16v14H8l-4 3z",
 reports:"M5 3h10l4 4v14H5z M15 3v5h4M8 12h8m-8 4h8",
 details:"M4 21V3h16v18M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2",
 switch:"M7 7h14l-4-4m4 4-4 4M17 17H3l4-4m-4 4 4 4",
 chevron:"m7 10 5 5 5-5",
 logout:"M10 17l5-5-5-5m5 5H3M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6",
 menuOpen:"M4 6h16M4 12h16M4 18h16",
 refresh:"M20 11a8 8 0 0 0-15-3M4 4v4h4M4 13a8 8 0 0 0 15 3m1 4v-4h-4",
 external:"M12 5h7v7m0-7-9 9M19 14v5H5V5h5",
 search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm6-2 5 5",
 plus:"M12 4v16M4 12h16",
 close:"M5 5l14 14M19 5 5 19"
};
export function BizIcon({name,size=19}:{name:IconName;size?:number}){
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
  fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
  <path d={icons[name]}/>
 </svg>;
}
export const viewText:Record<BusinessView,{title:string;subtitle:string}>={
 home:{title:"Sākums",subtitle:"Restorāna ikdienas darbības vienuviet"},
 orders:{title:"Pasūtījumi",subtitle:"Pasūtījumu vēsture, statusi un izpilde"},
 insights:{title:"Biznesa analītika",subtitle:"Pārdošanas tendences un operatīvie rādītāji"},
 menu:{title:"Ēdienkarte",subtitle:"Kategorijas, ēdieni, cenas un pieejamība"},
 zones:{title:"Piegādes zonas",subtitle:"Katrai lokācijai savas piegādes cenas un attālumi"},
 complaints:{title:"Sūdzības",subtitle:"Klientu sūdzības un daļējas atmaksas izvērtēšana"},
 reports:{title:"Finanšu pārskati",subtitle:"Izmaksu aprēķini un pārskatāma uzskaite"},
 details:{title:"Restorāna dati",subtitle:"Lokācijas informācija un piegādes sākumpunkts"}
};
const navGroups:{title:string;items:{id:BusinessView;label:string;icon:IconName}[]}[]=[
 {title:"Pārvaldība",items:[
  {id:"home",label:"Sākums",icon:"home"},
  {id:"orders",label:"Pasūtījumi",icon:"orders"},
  {id:"insights",label:"Biznesa analītika",icon:"insights"},
  {id:"reports",label:"Finanšu pārskati",icon:"reports"}
 ]},
 {title:"Restorāns",items:[
  {id:"menu",label:"Ēdienkarte",icon:"menu"},
  {id:"zones",label:"Piegādes zonas",icon:"zones"},
  {id:"complaints",label:"Sūdzības un atmaksas",icon:"complaints"},
  {id:"details",label:"Restorāna dati",icon:"details"}
 ]}
];
type SidebarProps={
 view:BusinessView;onNavigate:(v:BusinessView)=>void;
 venueName:string;email:string;onSwitch:()=>void;onSignOut:()=>void;
 mobileOpen:boolean;onCloseMobile:()=>void
};
export function BusinessSidebar({view,onNavigate,venueName,email,onSwitch,onSignOut,mobileOpen,onCloseMobile}:SidebarProps){
 return <>
  {mobileOpen&&<button className="biz-overlay" aria-label="Aizvērt izvēlni" onClick={onCloseMobile}/>}
  <aside className={"biz-sidebar "+(mobileOpen?"biz-sidebar-open":"")}>
   <div className="biz-sidebrand"><span className="biz-brand-mark">b.</span><span className="biz-brand">bait<span>me.</span></span><span className="biz-brand-tag">BUSINESS</span></div>
   <button className="biz-location-switch" onClick={onSwitch} title="Pārslēgt restorānu">
    <span className="biz-venue-avatar">{venueName?.slice(0,2).toLocaleUpperCase("lv")||"BM"}</span>
    <span className="biz-location-label"><strong>{venueName||"Nav restorāna"}</strong><small>Restorāna lokācija</small></span>
    <BizIcon name="switch" size={17}/>
   </button>
   <nav className="biz-navigation" aria-label="Biznesa panelis">
    {navGroups.map(g=><div key={g.title} className="biz-nav-group">
     <div className="biz-nav-group-title">{g.title}</div>
     {g.items.map(item=><button key={item.id} className={"biz-nav-item "+(view===item.id?"is-active":"")}
      aria-current={view===item.id?"page":undefined}
      onClick={()=>{onNavigate(item.id);onCloseMobile()}}>
      <BizIcon name={item.icon} size={18}/><span>{item.label}</span>
      </button>)}
    </div>)}
    <div className="biz-nav-group">
     <div className="biz-nav-group-title">Konts</div>
     <a className="biz-nav-item" href="/apply"><BizIcon name="plus" size={18}/>Pievienot restorānu</a>
     <a className="biz-nav-item" href="/admin"><BizIcon name="external" size={18}/>Operatora panelis</a>
    </div>
   </nav>
   <div className="biz-sidebar-bottom">
    <span className="biz-profile-avatar">{email.slice(0,1).toUpperCase()||"B"}</span>
    <div className="biz-profile-info"><strong>Mans konts</strong><small title={email}>{email}</small></div>
    <button className="biz-logout" title="Izrakstīties" aria-label="Izrakstīties" onClick={onSignOut}><BizIcon name="logout" size={18}/></button>
   </div>
  </aside>
 </>;
}
export function BusinessHeader({view,venueName,onOpenSwitcher,onOpenMobile,onRefresh,loading}:{
 view:BusinessView;venueName:string;onOpenSwitcher:()=>void;onOpenMobile:()=>void;onRefresh:()=>void;loading:boolean
}){
 return <header className="biz-topbar">
  <div className="biz-topbar-start">
   <button className="biz-mobile-menu biz-icon-button" onClick={onOpenMobile} aria-label="Atvērt izvēlni"><BizIcon name="menuOpen"/></button>
   <div className="biz-breadcrumb"><span>Business</span><span className="biz-breadcrumb-sep">/</span><strong>{viewText[view].title}</strong></div>
  </div>
  <div className="biz-topbar-actions">
   <button className="biz-top-venue" onClick={onOpenSwitcher} title="Izvēlēties restorānu">
    <span className="biz-store-dot"/><span className="biz-venue-truncate">{venueName||"Izvēlēties restorānu"}</span>
    <BizIcon name="chevron" size={16}/>
   </button>
   <button className="biz-icon-button" onClick={onRefresh} disabled={loading} title="Atjaunot datus" aria-label="Atjaunot datus"><BizIcon name="refresh"/></button>
  </div>
 </header>;
}
export function VenueSwitcher({open,onClose,venues,currentId,onSelect}:{
 open:boolean;onClose:()=>void;venues:VenueOption[];currentId:string;onSelect:(id:string)=>void
}){
 const [query,setQuery]=useState("");
 useEffect(()=>{if(open)setQuery("")},[open]);
 useEffect(()=>{
  if(!open)return;
  function onKey(e:KeyboardEvent){if(e.key==="Escape")onClose()}
  document.addEventListener("keydown",onKey);
  return ()=>document.removeEventListener("keydown",onKey);
 },[open,onClose]);
 if(!open)return null;
 const filtered=venues.filter(v=>(v.name+" "+v.slug).toLocaleLowerCase("lv").includes(query.toLocaleLowerCase("lv")));
 return <div className="biz-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="biz-modal" role="dialog" aria-modal="true" aria-label="Izvēlēties restorānu">
   <div className="biz-modal-heading"><h2>Izvēlies restorānu</h2><button className="biz-icon-button" aria-label="Aizvērt" onClick={onClose}><BizIcon name="close"/></button></div>
   <p className="muted">Pārslēdz lokāciju, lai skatītu tās pasūtījumus, ēdienkarti un piegādes zonas.</p>
   <label className="biz-search-field"><BizIcon name="search"/><input autoFocus placeholder="Meklēt restorānu..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="biz-modal-section-label">Mani restorāni ({filtered.length})</div>
   <div className="biz-venue-list">
    {filtered.map(v=><button key={v.id} className={"biz-venue-choice "+(v.id===currentId?"selected":"")}
     onClick={()=>{onSelect(v.id);onClose()}}>
     <span className="biz-choice-avatar">{v.name.slice(0,2).toUpperCase()}</span>
     <span className="biz-choice-info"><strong>{v.name}</strong><small>{v.slug} · {v.published?"Publicēts":"Nav publicēts"}</small></span>
     {v.id===currentId&&<span className="biz-choice-selected">Izvēlēts</span>}
    </button>)}
    {!filtered.length&&<div className="biz-empty">Nav atbilstošu restorānu.</div>}
   </div>
   <a className="biz-modal-footer-link" href="/apply"><BizIcon name="plus" size={16}/> Pieteikt jaunu restorānu</a>
  </section>
 </div>;
}
