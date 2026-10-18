-- CI-only integration: tenant isolation, persistent ordering, origin-based
-- radius zones, overlap rejection and unverified checkout rejection.
do $$
declare
 owner_a uuid:='91111111-1111-4111-8111-111111111111';
 owner_b uuid:='92222222-2222-4222-8222-222222222222';
 customer uuid:='93333333-3333-4333-8333-333333333333';
 rest_a uuid; rest_b uuid;
 cat_a uuid; cat_b uuid; cat_c uuid;
 menu_item uuid; radius_zone uuid;
 order_id uuid;
begin
 insert into auth.users(id) values(owner_a),(owner_b),(customer);
 insert into public.restaurants(owner_user_id,name,slug,published,
 pickup_address,latitude,longitude)
 values(owner_a,'Radius Restaurant A','radius-rest-a',true,
 'Riga, Latvija, centrs',56.9496,24.1052) returning id into rest_a;
 insert into public.restaurants(owner_user_id,name,slug,published,
 pickup_address,latitude,longitude)
 values(owner_b,'Radius Restaurant B','radius-rest-b',true,
 'Liepaja, Latvija, centrs',56.5047,21.0108) returning id into rest_b;
 insert into public.restaurant_staff(restaurant_id,user_id,role)
 values(rest_a,owner_a,'owner'),(rest_b,owner_b,'owner');

 insert into public.menu_categories(restaurant_id,name,sort_order)
 values(rest_a,'Burgeri',10) returning id into cat_a;
 insert into public.menu_categories(restaurant_id,name,sort_order)
 values(rest_a,'Uzkodas',20) returning id into cat_b;
 insert into public.menu_categories(restaurant_id,name,sort_order)
 values(rest_a,'Dzerieni',30) returning id into cat_c;
 if not public.move_baitme_category(owner_a,rest_a,cat_c,-1)
 then raise exception 'category move should succeed'; end if;
 if (select name from public.menu_categories where restaurant_id=rest_a
     order by sort_order,id limit 1 offset 1)<>'Dzerieni'
 then raise exception 'category order not persisted'; end if;
 if public.move_baitme_category(owner_a,rest_a,cat_a,-1)
 then raise exception 'first category must not move up'; end if;
 begin
  perform public.move_baitme_category(owner_b,rest_a,cat_b,-1);
  raise exception 'cross-restaurant category move allowed';
 exception when others then
  if sqlerrm='cross-restaurant category move allowed' then raise; end if;
 end;

 insert into public.delivery_zones(restaurant_id,name,zone_type,
   min_distance_m,max_distance_m,delivery_cents,active)
 values(rest_a,'Lidz 3 km','radius',0,3000,250,true) returning id into radius_zone;
 insert into public.delivery_zones(restaurant_id,name,zone_type,
   min_distance_m,max_distance_m,delivery_cents,active)
 values(rest_a,'3-7 km','radius',3000,7000,400,true);
 insert into public.delivery_zones(restaurant_id,name,zone_type,
   min_distance_m,max_distance_m,delivery_cents,active)
 values(rest_b,'Cita restorana 0-3 km','radius',0,3000,500,true);

 begin
  insert into public.delivery_zones(restaurant_id,name,zone_type,
    min_distance_m,max_distance_m,delivery_cents,active)
  values(rest_a,'Pārklājas','radius',2500,5000,100,true);
  raise exception 'overlap accepted';
 exception when others then
  if sqlerrm='overlap accepted' then raise; end if;
 end;
 insert into public.menu_items(restaurant_id,name,category,price_cents)
 values(rest_a,'Test Burger','Burgeri',1000) returning id into menu_item;
 begin
  order_id:=public.create_baitme_order(customer,rest_a,
    jsonb_build_array(jsonb_build_object('menuItemId',menu_item,'quantity',1)),
    'Testa iela 42','LV-1001',radius_zone);
  raise exception 'radius checkout was allowed without verified geocoding';
 exception when others then
  if sqlerrm='radius checkout was allowed without verified geocoding'
  then raise; end if;
 end;
 if exists(select 1 from public.orders where customer_id=customer)
 then raise exception 'invalid radius order persisted'; end if;
 raise notice 'Radius/ordering tests passed';
end $$;
