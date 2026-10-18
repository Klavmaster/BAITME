-- BaitMe 006: durable, restaurant-scoped menu categories and restaurant-origin delivery bands.
-- Radius zones are configurable NOW; checkout for those zones stays blocked until
-- a trusted server-side customer-address geocoder verifies distance and pricing.
-- Existing postal-prefix zones and orders remain intact.

create table if not exists public.menu_categories (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 name text not null check(length(btrim(name)) between 2 and 80 and btrim(name)=name),
 sort_order integer not null default 0 check (sort_order>=0),
 created_at timestamptz not null default now()
);
create unique index if not exists menu_categories_restaurant_lower_name
 on public.menu_categories(restaurant_id,lower(name));
create index if not exists menu_categories_order
 on public.menu_categories(restaurant_id,sort_order,id);
alter table public.menu_categories enable row level security;
revoke all on public.menu_categories from anon,authenticated;
grant select,insert,update,delete on public.menu_categories to service_role;

-- Carry existing manually entered menu categories into the new persistent model.
insert into public.menu_categories(restaurant_id,name,sort_order)
select restaurant_id,category,(row_number() over(partition by restaurant_id order by category))*10
from (select distinct restaurant_id,category from public.menu_items where btrim(category)<>'' and length(category)<=80) existing
on conflict do nothing;

-- Atomic move with a restaurant-level lock; an admin from restaurant A cannot
-- reorder restaurant B's categories. Role verified INSIDE the privileged function.
create or replace function public.move_baitme_category(
 p_actor uuid,p_restaurant uuid,p_category uuid,p_direction integer
) returns boolean language plpgsql security definer set search_path=public as $$
declare
 v_ids uuid[];
 v_pos integer;
 v_new integer;
 v_tmp uuid;
 v_i integer;
begin
 if p_direction not in (-1,1) then raise exception 'invalid direction'; end if;
 if not exists (select 1 from public.restaurant_staff
   where user_id=p_actor and restaurant_id=p_restaurant and role in ('owner','manager'))
 then raise exception 'not manager'; end if;
 perform 1 from public.restaurants where id=p_restaurant for update;
 if not found then raise exception 'restaurant not found'; end if;
 select array_agg(id order by sort_order,id) into v_ids
 from public.menu_categories where restaurant_id=p_restaurant;
 v_pos := array_position(v_ids,p_category);
 if v_pos is null then raise exception 'category not found'; end if;
 v_new := v_pos+p_direction;
 if v_new<1 or v_new>coalesce(array_length(v_ids,1),0) then return false; end if;
 v_tmp:=v_ids[v_new];
 v_ids[v_new]:=v_ids[v_pos];
 v_ids[v_pos]:=v_tmp;
 for v_i in 1..array_length(v_ids,1) loop
   update public.menu_categories set sort_order=v_i*10
    where id=v_ids[v_i] and restaurant_id=p_restaurant;
 end loop;
 return true;
end; $$;
revoke all on function public.move_baitme_category(uuid,uuid,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.move_baitme_category(uuid,uuid,uuid,integer) to service_role;

-- Restaurant origin is a required pair; missing coordinates are not silently
-- guessed from address or postal code. Each restaurant owns its own origin.
alter table public.restaurants
 add column if not exists pickup_address text,
 add column if not exists latitude double precision,
 add column if not exists longitude double precision;
alter table public.restaurants
 add constraint restaurant_origin_pair_chk
 check (
  (latitude is null and longitude is null) or
  (latitude between -90 and 90 and longitude between -180 and 180)
 );
alter table public.restaurants
 add constraint restaurant_pickup_address_chk
 check (pickup_address is null or length(btrim(pickup_address)) between 5 and 300);

-- Keep legacy postal zones valid. A new radius band is measured outward
-- from this restaurant's saved pickup coordinates.
alter table public.delivery_zones alter column postal_code_prefix drop not null;
alter table public.delivery_zones
 add column if not exists zone_type text not null default 'postal_prefix',
 add column if not exists min_distance_m integer,
 add column if not exists max_distance_m integer;
alter table public.delivery_zones
 add constraint delivery_zone_type_chk check (
   (zone_type='postal_prefix' and postal_code_prefix is not null and
      min_distance_m is null and max_distance_m is null)
   or
   (zone_type='radius' and postal_code_prefix is null and
      min_distance_m is not null and max_distance_m is not null
      and min_distance_m>=0 and max_distance_m>min_distance_m
      and max_distance_m<=100000)
 );
create index if not exists radius_zone_ranges
 on public.delivery_zones(restaurant_id,min_distance_m,max_distance_m)
 where zone_type='radius' and active;

-- Enforce no overlapping ACTIVE radius zones even under concurrent writes,
-- by serializing changes on the parent restaurant record.
create or replace function public.validate_baitme_radius_zone()
returns trigger language plpgsql set search_path=public as $$
declare v_origin record;
begin
 if new.zone_type='radius' and new.active then
   select latitude,longitude into v_origin
     from public.restaurants where id=new.restaurant_id for update;
   if v_origin.latitude is null or v_origin.longitude is null then
     raise exception 'restaurant origin not configured';
   end if;
   if exists(select 1 from public.delivery_zones z
      where z.restaurant_id=new.restaurant_id
      and z.id<>new.id and z.zone_type='radius' and z.active
      and z.min_distance_m<new.max_distance_m
      and new.min_distance_m<z.max_distance_m)
   then raise exception 'overlapping radius delivery zones'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists validate_baitme_radius_zone_trg on public.delivery_zones;
create trigger validate_baitme_radius_zone_trg
 before insert or update on public.delivery_zones
 for each row execute function public.validate_baitme_radius_zone();

-- Fail CLOSED: original RPC validates only postal prefixes. A radius selection
-- with a NULL prefix would otherwise evade its comparison under SQL 3VL.
-- Block draft/paid order creation until verified server-side geocoding exists.
create or replace function public.reject_unverified_radius_order()
returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.delivery_zones z
    where z.id=new.delivery_zone_id and z.zone_type='radius')
 then raise exception 'radius delivery requires verified address geocoding'
   using errcode='23514'; end if;
 return new;
end; $$;
drop trigger if exists reject_unverified_radius_order_trg on public.orders;
create trigger reject_unverified_radius_order_trg
 before insert or update of delivery_zone_id on public.orders
 for each row execute function public.reject_unverified_radius_order();
