-- Run after migrations against disposable PostgreSQL / staging only.
-- Deterministic sample account IDs are synthetic, NOT real customers.
do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_customer uuid := '22222222-2222-4222-8222-222222222222';
  v_courier uuid := '33333333-3333-4333-8333-333333333333';
  v_restaurant uuid;
  v_menu uuid;
  v_zone uuid;
  v_order uuid;
  v_order_record public.orders%rowtype;
  v_earning public.courier_earnings%rowtype;
  v_platform public.platform_fee_ledger%rowtype;
begin
  insert into auth.users(id) values (v_owner),(v_customer),(v_courier);
  insert into public.restaurants(owner_user_id,slug,name,published)
   values(v_owner,'test-burger','Test Restaurant',true)
   returning id into v_restaurant;
  insert into public.restaurant_staff(restaurant_id,user_id,role)
   values(v_restaurant,v_owner,'owner');
  insert into public.courier_profiles(user_id,display_name,approved)
   values(v_courier,'Synthetic Courier',true);
  insert into public.menu_items(restaurant_id,name,price_cents)
   values(v_restaurant,'Test Burger',2000)
   returning id into v_menu;
  insert into public.delivery_zones(restaurant_id,name,postal_code_prefix,delivery_cents)
   values(v_restaurant,'Test Zone','LV-10',350)
   returning id into v_zone;

  v_order:=public.create_baitme_order(v_customer,v_restaurant,
    jsonb_build_array(jsonb_build_object('menuItemId',v_menu,'quantity',1)),
    'Demo Street 12','LV-1001',v_zone);
  select * into v_order_record from public.orders where id=v_order;
  if v_order_record.food_cents<>2000 or v_order_record.delivery_cents<>350 or
     v_order_record.total_cents<>2350 or v_order_record.processing_fee_cents<>0 or
     v_order_record.status<>'awaiting_payment'
  then raise exception 'bad quote or unauthorised payment'; end if;

  -- Courier cannot claim an unpaid draft.
  begin
    perform public.claim_baitme_delivery(v_courier,v_order);
    raise exception 'unpaid claim must fail';
  exception when others then
    if sqlerrm='unpaid claim must fail' then raise; end if;
  end;

  -- Test-only synthetic payment event; NO app endpoint can do this.
  update public.orders set payment_status='paid',status='placed' where id=v_order;
  perform public.restaurant_baitme_transition(v_owner,v_restaurant,v_order,'accepted');
  perform public.restaurant_baitme_transition(v_owner,v_restaurant,v_order,'preparing');
  perform public.restaurant_baitme_transition(v_owner,v_restaurant,v_order,'ready_for_pickup');
  perform public.claim_baitme_delivery(v_courier,v_order);
  perform public.courier_baitme_transition(v_courier,v_order,'picked_up');

  if exists(select 1 from public.courier_earnings where order_id=v_order)
    or exists(select 1 from public.platform_fee_ledger where order_id=v_order)
    or (select platform_fee_cents from public.orders where id=v_order)<>0
    then raise exception 'fees accrued before delivery'; end if;

  perform public.courier_baitme_transition(v_courier,v_order,'delivered');
  select * into v_earning from public.courier_earnings where order_id=v_order;
  if v_earning.amount_cents<>350 or v_earning.courier_id<>v_courier or
    v_earning.payout_status<>'unpaid'
  then raise exception 'courier ledger incorrect'; end if;

  select * into v_platform from public.platform_fee_ledger where order_id=v_order;
  if v_platform.amount_cents<>50 or v_platform.state<>'accrued'
    or (select platform_fee_cents from public.orders where id=v_order)<>50
  then raise exception 'BaitMe EUR 0.50 fee not accrued'; end if;
  if (select food_cents - restaurant_processing_fee_cents - platform_fee_cents
    from public.orders where id=v_order)<>1950
  then raise exception 'restaurant net after platform fee wrong'; end if;

  begin
    perform public.courier_baitme_transition(v_courier,v_order,'delivered');
    raise exception 'duplicate delivery completion must fail';
  exception when others then
    if sqlerrm='duplicate delivery completion must fail' then raise; end if;
  end;

  if (select count(*) from public.courier_earnings where order_id=v_order)<>1
    or (select count(*) from public.platform_fee_ledger where order_id=v_order)<>1
    then raise exception 'duplicate courier/platform fee accrued'; end if;

  if has_table_privilege('anon','public.orders','select') or
     has_table_privilege('authenticated','public.orders','select') or
     has_table_privilege('anon','public.restaurants','select')
    then raise exception 'direct public table access not locked down'; end if;
  raise notice 'BaitMe DB E2E passed: paid order, courier claim, delivery, EUR 0.50 fixed fee accrued exactly once';
end $$;
