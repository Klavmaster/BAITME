import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { db, authenticate, hasRestaurantRole, hasCourierRole } from "./db.mjs";

const app=express();
app.disable("x-powered-by");
app.use(helmet());
const origins=(process.env.ALLOWED_ORIGINS||"").split(",").map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin(origin,cb) {
    if (!origin || origins.includes(origin)) return cb(null,true);
    return cb(new Error("CORS origin not allowed"));
  }
}));
app.use(express.json({limit:"64kb"}));
const fail=(res,code,message)=>res.status(code).json({error:message});
const uuid=s=>typeof s==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const controlledError=(res,error)=>{
  // Never leak SQL, internal schema or key material.
  if(error?.code==="P0001"||error?.code==="22023"||error?.code==="23514") return fail(res,400,"Nepareizi vai neatļauti dati");
  console.error("[baitme api]",error?.code||error?.name||"unknown");
  return fail(res,500,"Servera kļūda");
};
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
async function requireUser(req,res,next) {
  try {
    const m=/^Bearer (.+)$/i.exec(req.header("authorization")||"");
    const user=await authenticate(m?.[1]);
    if(!user) return fail(res,401,"Nepieciešama autorizācija");
    req.user=user;
    next();
  } catch(error){next(error);}
}
app.get("/health",(_req,res)=>res.json({ok:true,app:"baitme",payments:false}));
app.get("/v1/restaurants",wrap(async(req,res)=>{
  const {data,error}=await db().from("restaurants")
    .select("id,slug,name,description,category,image_url,delivery_eta_min,delivery_eta_max")
    .eq("published",true).order("name").limit(100);
  if(error)return controlledError(res,error);
  res.json({restaurants:data});
}));
app.get("/v1/restaurants/:id/menu",wrap(async(req,res)=>{
  if(!uuid(req.params.id))return fail(res,400,"Nederīgs restorāna ID");
  const {data:restaurant,error:e1}=await db().from("restaurants")
   .select("id,name,description,category,image_url,delivery_eta_min,delivery_eta_max")
   .eq("id",req.params.id).eq("published",true).maybeSingle();
  if(e1)return controlledError(res,e1);
  if(!restaurant)return fail(res,404,"Restorāns nav atrasts");
  const [items,zones]=await Promise.all([
    db().from("menu_items").select("id,name,description,price_cents,image_url,category")
      .eq("restaurant_id",restaurant.id).eq("available",true).order("sort_order").limit(200),
    db().from("delivery_zones").select("id,name,postal_code_prefix,delivery_cents")
      .eq("restaurant_id",restaurant.id).eq("active",true).limit(100)
  ]);
  if(items.error||zones.error)return controlledError(res,items.error||zones.error);
  res.json({restaurant,items:items.data,deliveryZones:zones.data});
}));
app.get("/v1/me",requireUser,(req,res)=>res.json({id:req.user.id,email:req.user.email}));

app.post("/v1/orders",requireUser,wrap(async(req,res)=>{
  const {restaurantId,items,addressLine,postalCode,deliveryZoneId}=req.body||{};
  if(!uuid(restaurantId)||!uuid(deliveryZoneId)||
     !Array.isArray(items)||items.length===0||items.length>50||
     !items.every(x=>uuid(x?.menuItemId)&&Number.isSafeInteger(x?.quantity)&&x.quantity>=1&&x.quantity<=20)||
     typeof addressLine!=="string"||addressLine.trim().length<8||addressLine.length>400||
     typeof postalCode!=="string"||!/^LV-\d{4}$/.test(postalCode.toUpperCase()))
    return fail(res,400,"Nederīgi pasūtījuma dati");
  // Prices, delivery charge, totals and permissions are computed inside PostgreSQL,
  // never trusted from client JSON.
  const {data,error}=await db().rpc("create_baitme_order",{
    p_customer_id:req.user.id,p_restaurant_id:restaurantId,
    p_items:items,p_address_line:addressLine.trim(),
    p_postal_code:postalCode.toUpperCase(),p_delivery_zone_id:deliveryZoneId
  });
  if(error)return controlledError(res,error);
  return res.status(201).json({orderId:data,paymentState:"awaiting_payment",checkoutAvailable:false});
}));
app.get("/v1/orders/mine",requireUser,wrap(async(req,res)=>{
  const {data,error}=await db().from("orders")
    .select("id,restaurant_id,status,payment_status,food_cents,delivery_cents,processing_fee_cents,total_cents,created_at")
    .eq("customer_id",req.user.id).order("created_at",{ascending:false}).limit(50);
  if(error)return controlledError(res,error);
  res.json({orders:data});
}));
app.get("/v1/restaurant/mine",requireUser,wrap(async(req,res)=>{
  const {data:staff,error}=await db().from("restaurant_staff")
    .select("restaurant_id,role").eq("user_id",req.user.id).limit(100);
  if(error)return controlledError(res,error);
  if(!staff.length)return res.json({restaurants:[]});
  const {data,error:err}=await db().from("restaurants")
    .select("id,name,published,slug").in("id",staff.map(x=>x.restaurant_id)).limit(100);
  if(err)return controlledError(res,err);
  res.json({restaurants:data.map(x=>({...x,role:staff.find(s=>s.restaurant_id===x.id)?.role}))});
}));
app.get("/v1/restaurant/:restaurantId/menu",requireUser,wrap(async(req,res)=>{
  const id=req.params.restaurantId;
  if(!uuid(id))return fail(res,400,"Nederīgs ID");
  if(!await hasRestaurantRole(req.user.id,id))return fail(res,403,"Nav piekļuves");
  const {data,error}=await db().from("menu_items")
   .select("id,name,description,category,price_cents,image_url,available,sort_order")
   .eq("restaurant_id",id).order("sort_order").limit(200);
  if(error)return controlledError(res,error);
  res.json({items:data});
}));
app.post("/v1/restaurant/:restaurantId/menu",requireUser,wrap(async(req,res)=>{
  const id=req.params.restaurantId;
  const {name,description,category,priceCents}=req.body||{};
  if(!uuid(id)||typeof name!=="string"||name.trim().length<2||name.length>100||
      typeof description!=="string"||description.length>500||
      typeof category!=="string"||category.length>80||
      !Number.isSafeInteger(priceCents)||priceCents<0||priceCents>1000000)
    return fail(res,400,"Nederīgi ēdiena dati");
  if(!await hasRestaurantRole(req.user.id,id))return fail(res,403,"Nav piekļuves");
  const {data,error}=await db().from("menu_items").insert({
    restaurant_id:id,name:name.trim(),description,category,price_cents:priceCents,
    available:true
  }).select("id").single();
  if(error)return controlledError(res,error);
  res.status(201).json({id:data.id});
}));
app.patch("/v1/restaurant/:restaurantId/menu/:itemId",requireUser,wrap(async(req,res)=>{
  const {restaurantId,itemId}=req.params;
  if(!uuid(restaurantId)||!uuid(itemId))return fail(res,400,"Nederīgs ID");
  if(!await hasRestaurantRole(req.user.id,restaurantId))return fail(res,403,"Nav piekļuves");
  const allowed=new Set(["name","description","category","price_cents","available"]);
  const patch={};
  for(const [key,value] of Object.entries(req.body||{})){
    if(!allowed.has(key))return fail(res,400,"Neatļauts lauks");
    if(key==="name" && (typeof value!=="string"||value.trim().length<2||value.length>100)) return fail(res,400,"Nederīgs nosaukums");
    if(key==="description" && (typeof value!=="string"||value.length>500)) return fail(res,400,"Nederīgs apraksts");
    if(key==="category" && (typeof value!=="string"||value.length>80))return fail(res,400,"Nederīga kategorija");
    if(key==="price_cents" && (!Number.isSafeInteger(value)||value<0||value>1000000))return fail(res,400,"Nederīga cena");
    if(key==="available" && typeof value!=="boolean") return fail(res,400,"Nederīga pieejamība");
    patch[key]=typeof value==="string"?value.trim():value;
  }
  if(!Object.keys(patch).length)return fail(res,400,"Nav izmaiņu");
  const {data,error}=await db().from("menu_items").update(patch)
    .eq("id",itemId).eq("restaurant_id",restaurantId).select("id").maybeSingle();
  if(error)return controlledError(res,error);
  if(!data)return fail(res,404,"Ēdiens nav atrasts");
  res.json({id:data.id});
}));
app.get("/v1/restaurant/:restaurantId/zones",requireUser,wrap(async(req,res)=>{
  const id=req.params.restaurantId;
  if(!uuid(id))return fail(res,400,"Nederīgs ID");
  if(!await hasRestaurantRole(req.user.id,id))return fail(res,403,"Nav piekļuves");
  const {data,error}=await db().from("delivery_zones")
    .select("id,name,postal_code_prefix,delivery_cents,active")
    .eq("restaurant_id",id).order("name").limit(100);
  if(error)return controlledError(res,error);
  res.json({zones:data});
}));
app.post("/v1/restaurant/:restaurantId/zones",requireUser,wrap(async(req,res)=>{
  const id=req.params.restaurantId;
  const {name,postalCodePrefix,deliveryCents}=req.body||{};
  if(!uuid(id)||typeof name!=="string"||name.trim().length<2||name.length>80||
      typeof postalCodePrefix!=="string"||!/^LV-[0-9]{1,4}$/.test(postalCodePrefix)||
      !Number.isSafeInteger(deliveryCents)||deliveryCents<0||deliveryCents>100000)
    return fail(res,400,"Nederīgi zonas dati");
  if(!await hasRestaurantRole(req.user.id,id))return fail(res,403,"Nav piekļuves");
  const {data,error}=await db().from("delivery_zones").insert({
    restaurant_id:id,name:name.trim(),postal_code_prefix:postalCodePrefix,
    delivery_cents:deliveryCents,active:true
  }).select("id").single();
  if(error)return controlledError(res,error);
  res.status(201).json({id:data.id});
}));
app.get("/v1/restaurant/:restaurantId/summary",requireUser,wrap(async(req,res)=>{
  const id=req.params.restaurantId;
  if(!uuid(id))return fail(res,400,"Nederīgs ID");
  if(!await hasRestaurantRole(req.user.id,id))return fail(res,403,"Nav piekļuves");
  const {data,error}=await db().from("orders")
    .select("status,payment_status,food_cents,delivery_cents,total_cents")
    .eq("restaurant_id",id).limit(2000);
  if(error)return controlledError(res,error);
  const paid=data.filter(x=>x.payment_status==="paid"||x.payment_status==="partially_refunded");
  res.json({summary:{
    totalOrders:data.length,paidOrders:paid.length,foodCents:paid.reduce((a,x)=>a+x.food_cents,0),
    pendingOrders:data.filter(x=>["placed","accepted","preparing","ready_for_pickup"].includes(x.status)).length
  }});
}));
app.get("/v1/restaurant/:restaurantId/orders",requireUser,wrap(async(req,res)=>{
  const id=req.params.restaurantId;
  if(!uuid(id))return fail(res,400,"Nederīgs ID");
  if(!await hasRestaurantRole(req.user.id,id))return fail(res,403,"Nav restorāna piekļuves");
  const {data,error}=await db().from("orders")
    .select("id,status,payment_status,address_line,postal_code,food_cents,delivery_cents,total_cents,created_at,order_items(name,unit_price_cents,quantity)")
    .eq("restaurant_id",id).order("created_at",{ascending:false}).limit(100);
  if(error)return controlledError(res,error);
  res.json({orders:data});
}));
app.post("/v1/restaurant/:restaurantId/orders/:orderId/status",requireUser,wrap(async(req,res)=>{
  if(!uuid(req.params.restaurantId)||!uuid(req.params.orderId)||!["accepted","preparing","ready_for_pickup","cancelled"].includes(req.body?.status))
    return fail(res,400,"Nederīgs statuss");
  if(!await hasRestaurantRole(req.user.id,req.params.restaurantId))return fail(res,403,"Nav piekļuves");
  const {data,error}=await db().rpc("restaurant_baitme_transition",{
    p_actor_id:req.user.id,p_restaurant_id:req.params.restaurantId,
    p_order_id:req.params.orderId,p_target:req.body.status
  });
  if(error)return controlledError(res,error);
  res.json({orderId:data});
}));
app.get("/v1/courier/jobs",requireUser,wrap(async(req,res)=>{
  if(!await hasCourierRole(req.user.id))return fail(res,403,"Kurjers nav apstiprināts");
  const {data,error}=await db().from("orders")
    .select("id,restaurant_id,address_line,postal_code,delivery_cents,status,created_at")
    .eq("payment_status","paid").eq("status","ready_for_pickup")
    .is("courier_id",null).order("created_at").limit(50);
  if(error)return controlledError(res,error);
  res.json({jobs:data});
}));
app.post("/v1/courier/jobs/:orderId/claim",requireUser,wrap(async(req,res)=>{
  if(!uuid(req.params.orderId))return fail(res,400,"Nederīgs ID");
  if(!await hasCourierRole(req.user.id))return fail(res,403,"Kurjers nav apstiprināts");
  const {data,error}=await db().rpc("claim_baitme_delivery",{
    p_courier_id:req.user.id,p_order_id:req.params.orderId
  });
  if(error)return controlledError(res,error);
  res.json({orderId:data});
}));
app.get("/v1/courier/mine",requireUser,wrap(async(req,res)=>{
  if(!await hasCourierRole(req.user.id))return fail(res,403,"Kurjers nav apstiprināts");
  const {data,error}=await db().from("orders")
    .select("id,restaurant_id,address_line,postal_code,delivery_cents,status,payment_status,created_at")
    .eq("courier_id",req.user.id).order("created_at",{ascending:false}).limit(50);
  if(error)return controlledError(res,error);
  res.json({orders:data});
}));
app.post("/v1/courier/jobs/:orderId/status",requireUser,wrap(async(req,res)=>{
  if(!uuid(req.params.orderId)||!["picked_up","delivered"].includes(req.body?.status))
    return fail(res,400,"Nederīgs statuss");
  if(!await hasCourierRole(req.user.id))return fail(res,403,"Kurjers nav apstiprināts");
  const {data,error}=await db().rpc("courier_baitme_transition",{
    p_courier_id:req.user.id,p_order_id:req.params.orderId,p_target:req.body.status
  });
  if(error)return controlledError(res,error);
  res.json({orderId:data});
}));
app.post("/v1/orders/:id/checkout",requireUser,(_req,res)=>fail(res,503,
  "Reāli maksājumi nav aktivizēti: jāpārbauda Stripe Connect, juridiskā atbilstība un atmaksa."
));
app.use((err,_req,res,_next)=>{
  if(err?.type==="entity.parse.failed")return fail(res,400,"Nederīgs JSON");
  if(err?.message==="CORS origin not allowed")return fail(res,403,"Neatļauta izcelsme");
  return controlledError(res,err);
});
if(process.argv[1]===new URL(import.meta.url).pathname){
  const port=Number(process.env.PORT||8787);
  app.listen(port,()=>console.log("BaitMe API ready on "+port+"; live payments OFF"));
}
export {app};
