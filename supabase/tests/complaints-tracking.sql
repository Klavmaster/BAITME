-- Disposable PostgreSQL integration test after migrations 001–004.
do $$
declare
 v_owner uuid := '44444444-4444-4444-8444-444444444444';
 v_customer uuid := '55555555-5555-4555-8555-555555555555';
 v_courier uuid := '66666666-6666-4666-8666-666666666666';
 v_admin uuid := '77777777-7777-4777-8777-777777777777';
 v_restaurant uuid; v_item uuid; v_zone uuid; v_order uuid; v_case uuid;
 v_location public.courier_live_locations%rowtype;
 v_case_row public.complaint_cases%rowtype;
begin
 insert into auth.users(id) values (v_owner),(v_customer),(v_courier),(v_admin);
 insert into public.platform_admins(user_id) values (v_admin);
 insert into public.restaurants(owner_user_id,slug,name,published)
   values(v_owner,'complaint-smoke-rest','Smoke Test Restaurant',true)
   returning id into v_restaurant;
 insert into public.restaurant_staff(restaurant_id,user_id,role)
   values(v_restaurant,v_owner,'owner');
 insert into public.courier_profiles(user_id,display_name,approved)
   values(v_courier,'Smoke Test Courier',true);
 insert into public.menu_items(restaurant_id,name,price_cents) 
  values(v_restaurant,'Test Food',2000) returning id into v_item;
 insert into public.delivery_zones(restaurant_id,name,postal_code_prefix,delivery_cents)
  values(v_restaurant,'Test Riga','LV-10',350) returning id into v_zone;
 v_order:=public.create_baitme_order(v_customer,v_restaurant,
   jsonb_build_array(jsonb_build_object('menuItemId',v_item,'quantity',1)),
   'Miera iela 11','LV-1010',v_zone);
 -- Customer can't complain about uncollected demo order.
 begin
  perform public.create_baitme_complaint(v_customer,v_order,'quality','Food was not as described',400);
  raise exception 'unpaid complaint accepted';
 exception when others then
  if sqlerrm='unpaid complaint accepted' then raise; end if;
 end;
 update public.orders set payment_status='paid',status='placed' where id=v_order;
 v_case:=public.create_baitme_complaint(v_customer,v_order,'quality',
  'Food arrived cold and missing ingredients',400);
 begin
  perform public.create_baitme_complaint(v_customer,v_order,'quality','A duplicate complaint submitted',400);
  raise exception 'duplicate case accepted';
 exception when unique_violation then null;
 end;
 begin
  perform public.review_baitme_complaint(v_admin,v_case,true,300,'Refund after review');
  raise exception 'review before restaurant response accepted';
 exception when others then
  if sqlerrm='review before restaurant response accepted' then raise; end if;
 end;
 perform public.respond_baitme_complaint(v_owner,v_restaurant,v_case,
  'We checked the order record and recommend a partial refund.',250);
 begin
  perform public.review_baitme_complaint(v_admin,v_case,true,2001,'Refund requested above food');
  raise exception 'over-refund accepted';
 exception when others then
  if sqlerrm='over-refund accepted' then raise; end if;
 end;
 perform public.review_baitme_complaint(v_admin,v_case,true,300,'Reviewed missing ingredients and food quality');
 select * into v_case_row from public.complaint_cases where id=v_case;
 if v_case_row.status<>'approved_pending_refund' or v_case_row.approved_refund_cents<>300
   or v_case_row.stripe_refund_id is not null or v_case_row.refund_completed_at is not null
 then raise exception 'complaint improperly marked paid'; end if;

 -- Assigned courier can share only for an active PAID job.
 begin
  perform public.upsert_baitme_courier_location(v_courier,v_order,56.95,24.11,20);
  raise exception 'location shared before assignment';
 exception when others then
  if sqlerrm='location shared before assignment' then raise; end if;
 end;
 update public.orders set status='ready_for_pickup',courier_id=v_courier where id=v_order;
 perform public.upsert_baitme_courier_location(v_courier,v_order,56.95,24.11,20);
 select * into v_location from public.courier_live_locations where order_id=v_order;
 if v_location.latitude<>56.95 or v_location.longitude<>24.11
 then raise exception 'location update failed';end if;
 begin
  perform public.upsert_baitme_courier_location(v_customer,v_order,56.95,24.11,20);
  raise exception 'other user shared location';
 exception when others then
  if sqlerrm='other user shared location' then raise;end if;
 end;
 perform public.stop_baitme_courier_location(v_courier,v_order);
 if exists(select 1 from public.courier_live_locations where order_id=v_order)
 then raise exception 'location revoke did not delete point';end if;
 perform public.upsert_baitme_courier_location(v_courier,v_order,56.95,24.11,20);
 update public.orders set status='delivered' where id=v_order;
 if public.purge_expired_baitme_locations()<>1 or
    exists(select 1 from public.courier_live_locations where order_id=v_order)
 then raise exception 'completed delivery location not purged';end if;
 raise notice 'Complaint and opt-in courier location smoke tests passed';
end $$;
