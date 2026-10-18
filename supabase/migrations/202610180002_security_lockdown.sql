-- Critical defense-in-depth: public client access only via vetted API projections.
-- RLS policies do not restrict columns. Public select policies could otherwise
-- reveal restaurant owner's user IDs and future Stripe account identifiers.
drop policy if exists restaurants_public on public.restaurants;
drop policy if exists menu_public on public.menu_items;
drop policy if exists zones_public on public.delivery_zones;

revoke all on public.restaurants from anon,authenticated;
revoke all on public.restaurant_staff from anon,authenticated;
revoke all on public.menu_items from anon,authenticated;
revoke all on public.delivery_zones from anon,authenticated;
revoke all on public.courier_profiles from anon,authenticated;
revoke all on public.orders from anon,authenticated;
revoke all on public.order_items from anon,authenticated;
revoke all on public.courier_earnings from anon,authenticated;
revoke all on public.order_events from anon,authenticated;

-- Service role alone accesses database via the authenticated server API.
grant select,insert,update,delete on public.restaurants to service_role;
grant select,insert,update,delete on public.restaurant_staff to service_role;
grant select,insert,update,delete on public.menu_items to service_role;
grant select,insert,update,delete on public.delivery_zones to service_role;
grant select,insert,update,delete on public.courier_profiles to service_role;
grant select,insert,update,delete on public.orders to service_role;
grant select,insert,update,delete on public.order_items to service_role;
grant select,insert,update,delete on public.courier_earnings to service_role;
grant select,insert,update,delete on public.order_events to service_role;
grant usage,select on sequence public.order_events_id_seq to service_role;
