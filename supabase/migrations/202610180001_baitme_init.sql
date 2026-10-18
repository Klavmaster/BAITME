-- BaitMe: first migration. Apply manually in your OWN Supabase project's SQL editor.
-- No mock/demo account or real payment is created.
-- Application clients must NEVER receive the service-role key.
create extension if not exists pgcrypto;

create table if not exists public.restaurants (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id),
 slug text not null unique,
 name text not null,
 description text not null default '',
 category text not null default 'Citi',
 image_url text,
 delivery_eta_min integer not null default 25 check(delivery_eta_min between 1 and 240),
 delivery_eta_max integer not null default 45 check(delivery_eta_max>=delivery_eta_min and delivery_eta_max<=360),
 published boolean not null default false,
 stripe_account_id text,
 created_at timestamptz not null default now()
);
create index if not exists restaurants_published_idx on public.restaurants(published);

create table if not exists public.restaurant_staff (
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','manager','staff')),
 primary key(restaurant_id,user_id)
);
create index if not exists restaurant_staff_user_idx on public.restaurant_staff(user_id);

create table if not exists public.menu_items (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null,
 description text not null default '',
 category text not null default 'Ēdieni',
 image_url text,
 price_cents integer not null check(price_cents >= 0),
 available boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists menu_items_restaurant_idx on public.menu_items(restaurant_id,sort_order);

-- The first iteration matches a customer-entered LV-xxxx code against zone
-- prefix configured by the restaurant. Address validation/geocoding is required
-- before real-money launch; this is NOT a precise geofence.
create table if not exists public.delivery_zones (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null,
 postal_code_prefix text not null check(postal_code_prefix ~ '^LV-[0-9]{1,4}$'),
 delivery_cents integer not null check(delivery_cents>=0),
 active boolean not null default true,
 unique(restaurant_id,postal_code_prefix)
);

create table if not exists public.courier_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null,
 approved boolean not null default false,
 stripe_account_id text,
 created_at timestamptz not null default now()
);

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id),
 restaurant_id uuid not null references public.restaurants(id),
 delivery_zone_id uuid not null references public.delivery_zones(id),
 courier_id uuid references public.courier_profiles(user_id),
 address_line text not null check(length(address_line) between 8 and 400),
 postal_code text not null check(postal_code ~ '^LV-[0-9]{4}$'),
 status text not null default 'awaiting_payment'
    check(status in ('awaiting_payment','placed','accepted','preparing','ready_for_pickup','picked_up','delivered','cancelled')),
 payment_status text not null default 'unpaid'
    check(payment_status in ('unpaid','paid','partially_refunded','refunded')),
 food_cents integer not null check(food_cents>=0),
 delivery_cents integer not null check(delivery_cents>=0),
 processing_fee_cents integer not null default 0 check(processing_fee_cents>=0),
 total_cents integer not null check(total_cents=food_cents+delivery_cents+processing_fee_cents),
 stripe_payment_intent_id text unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id,created_at desc);
create index if not exists orders_restaurant_idx on public.orders(restaurant_id,created_at desc);
create index if not exists orders_courier_idx on public.orders(courier_id,created_at desc);
create index if not exists orders_dispatch_idx on public.orders(status,payment_status) where courier_id is null;

create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 menu_item_id uuid not null references public.menu_items(id),
 name text not null,
 unit_price_cents integer not null check(unit_price_cents>=0),
 quantity integer not null check(quantity between 1 and 20),
 line_total_cents integer generated always as (unit_price_cents*quantity) stored
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Amount owed to courier once a completed PAID delivery occurs.
-- No payout is initiated here. Separate Stripe payout reconciliation is mandatory.
create table if not exists public.courier_earnings (
 order_id uuid primary key references public.orders(id),
 courier_id uuid not null references public.courier_profiles(user_id),
 amount_cents integer not null check(amount_cents>=0),
 payout_status text not null default 'unpaid'
   check(payout_status in ('unpaid','processing','paid','adjusted')),
 created_at timestamptz not null default now()
);

create table if not exists public.order_events (
 id bigint generated always as identity primary key,
 order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid references auth.users(id),
 event_type text not null,
 previous_status text,
 next_status text,
 created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id,created_at);

-- Default deny. All writes go through the verified, server-side API with
-- service role and the SECURITY DEFINER RPC functions.
alter table public.restaurants enable row level security;
alter table public.restaurant_staff enable row level security;
alter table public.menu_items enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.courier_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.courier_earnings enable row level security;
alter table public.order_events enable row level security;

-- Only publicly visible restaurants and menus may be selected with anon key.
drop policy if exists restaurants_public on public.restaurants;
create policy restaurants_public on public.restaurants for select to anon, authenticated using (published=true);
drop policy if exists menu_public on public.menu_items;
create policy menu_public on public.menu_items for select to anon, authenticated
using (available=true and exists(select 1 from public.restaurants r where r.id=restaurant_id and r.published=true));
drop policy if exists zones_public on public.delivery_zones;
create policy zones_public on public.delivery_zones for select to anon, authenticated
using (active=true and exists(select 1 from public.restaurants r where r.id=restaurant_id and r.published=true));

-- Prices and totals read from DB: never accept client-submitted money values.
create or replace function public.create_baitme_order(
 p_customer_id uuid,p_restaurant_id uuid,p_items jsonb,
 p_address_line text,p_postal_code text,p_delivery_zone_id uuid
) returns uuid language plpgsql security definer set search_path=public
as $$
declare
 v_zone public.delivery_zones%rowtype;
 v_item public.menu_items%rowtype;
 v_order_id uuid;
 v_row jsonb;
 v_food bigint := 0;
 v_quantity integer;
 v_line_total bigint;
begin
 if not exists(select 1 from auth.users where id=p_customer_id) then raise exception 'unknown user'; end if;
 if not exists(select 1 from public.restaurants where id=p_restaurant_id and published=true) then raise exception 'restaurant not found'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50
 then raise exception 'invalid items'; end if;
 if length(trim(coalesce(p_address_line,''))) not between 8 and 400 or p_postal_code !~ '^LV-[0-9]{4}$'
 then raise exception 'invalid address'; end if;
 select * into v_zone from public.delivery_zones
  where id=p_delivery_zone_id and restaurant_id=p_restaurant_id and active=true;
 if not found or left(p_postal_code,length(v_zone.postal_code_prefix))<>v_zone.postal_code_prefix
 then raise exception 'delivery zone unavailable'; end if;

 -- Lock menu rows against concurrent price edits during the snapshot.
 for v_row in select value from jsonb_array_elements(p_items)
 loop
   if jsonb_typeof(v_row)<>'object' then raise exception 'invalid line'; end if;
   v_quantity:=(v_row->>'quantity')::integer;
   if v_quantity not between 1 and 20 then raise exception 'invalid quantity'; end if;
   select * into v_item from public.menu_items
      where id=(v_row->>'menuItemId')::uuid and restaurant_id=p_restaurant_id and available=true
      for share;
   if not found then raise exception 'menu item unavailable'; end if;
   v_line_total:=v_item.price_cents::bigint*v_quantity;
   v_food:=v_food+v_line_total;
   if v_food > 2147483647 or v_food+v_zone.delivery_cents > 2147483647
   then raise exception 'order amount too large'; end if;
 end loop;

 insert into public.orders(customer_id,restaurant_id,delivery_zone_id,address_line,postal_code,
 food_cents,delivery_cents,processing_fee_cents,total_cents)
 values(p_customer_id,p_restaurant_id,p_delivery_zone_id,trim(p_address_line),p_postal_code,
 v_food::integer,v_zone.delivery_cents,0,(v_food+v_zone.delivery_cents)::integer)
 returning id into v_order_id;

 for v_row in select value from jsonb_array_elements(p_items)
 loop
   select * into v_item from public.menu_items
      where id=(v_row->>'menuItemId')::uuid and restaurant_id=p_restaurant_id;
   insert into public.order_items(order_id,menu_item_id,name,unit_price_cents,quantity)
     values(v_order_id,v_item.id,v_item.name,v_item.price_cents,(v_row->>'quantity')::integer);
 end loop;
 insert into public.order_events(order_id,actor_id,event_type,next_status)
 values(v_order_id,p_customer_id,'order_created','awaiting_payment');
 return v_order_id;
end; $$;

create or replace function public.restaurant_baitme_transition(
 p_actor_id uuid,p_restaurant_id uuid,p_order_id uuid,p_target text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v public.orders%rowtype;
begin
 if not exists(select 1 from public.restaurant_staff
    where restaurant_id=p_restaurant_id and user_id=p_actor_id)
 then raise exception 'not restaurant staff'; end if;
 select * into v from public.orders where id=p_order_id and restaurant_id=p_restaurant_id for update;
 if not found or v.payment_status<>'paid' then raise exception 'order not paid'; end if;
 if not (
  (v.status='placed' and p_target in ('accepted','cancelled')) or
  (v.status='accepted' and p_target in ('preparing','cancelled')) or
  (v.status='preparing' and p_target in ('ready_for_pickup','cancelled'))
 ) then raise exception 'invalid restaurant transition'; end if;
 update public.orders set status=p_target, updated_at=now() where id=v.id;
 insert into public.order_events(order_id,actor_id,event_type,previous_status,next_status)
 values(v.id,p_actor_id,'restaurant_status',v.status,p_target);
 return v.id;
end; $$;

create or replace function public.claim_baitme_delivery(
 p_courier_id uuid,p_order_id uuid
) returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
 if not exists(select 1 from public.courier_profiles where user_id=p_courier_id and approved=true)
 then raise exception 'courier not approved'; end if;
 update public.orders set courier_id=p_courier_id,updated_at=now()
 where id=p_order_id and status='ready_for_pickup' and payment_status='paid' and courier_id is null
 returning id into v;
 if v is null then raise exception 'job already claimed or unavailable'; end if;
 insert into public.order_events(order_id,actor_id,event_type)
 values(v,p_courier_id,'courier_claimed');
 return v;
end; $$;

create or replace function public.courier_baitme_transition(
 p_courier_id uuid,p_order_id uuid,p_target text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v public.orders%rowtype;
begin
 if not exists(select 1 from public.courier_profiles where user_id=p_courier_id and approved=true)
 then raise exception 'courier not approved'; end if;
 select * into v from public.orders where id=p_order_id and courier_id=p_courier_id for update;
 if not found or v.payment_status<>'paid' then raise exception 'not assigned to paid order'; end if;
 if not ((v.status='ready_for_pickup' and p_target='picked_up') or
  (v.status='picked_up' and p_target='delivered'))
 then raise exception 'invalid courier transition'; end if;
 update public.orders set status=p_target,updated_at=now() where id=v.id;
 insert into public.order_events(order_id,actor_id,event_type,previous_status,next_status)
 values(v.id,p_courier_id,'courier_status',v.status,p_target);
 if p_target='delivered' then
   insert into public.courier_earnings(order_id,courier_id,amount_cents)
   values(v.id,p_courier_id,v.delivery_cents)
   on conflict(order_id) do nothing;
 end if;
 return v.id;
end; $$;

-- No public access to privileged SECURITY DEFINER functions.
revoke all on function public.create_baitme_order(uuid,uuid,jsonb,text,text,uuid) from public,anon,authenticated;
revoke all on function public.restaurant_baitme_transition(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_baitme_delivery(uuid,uuid) from public,anon,authenticated;
revoke all on function public.courier_baitme_transition(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_baitme_order(uuid,uuid,jsonb,text,text,uuid) to service_role;
grant execute on function public.restaurant_baitme_transition(uuid,uuid,uuid,text) to service_role;
grant execute on function public.claim_baitme_delivery(uuid,uuid) to service_role;
grant execute on function public.courier_baitme_transition(uuid,uuid,text) to service_role;

-- Owner / staff and couriers must be onboarded by authorised operator
-- after their Supabase Auth user and payment profile are verified.
-- Never auto-approve a courier on public sign-up.
