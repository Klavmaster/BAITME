-- BaitMe 005: fixed EUR 0.50 fee to RESTAURANT on a successfully delivered, paid order.
-- This is an ACCRUAL ledger, NOT a Stripe collection/transfer. Apply after 001..004.
-- Customer checkout total remains food + courier delivery; courier's delivery amount
-- is unchanged. Processor fees are a separate restaurant expense in migration 004.
-- This migration must be applied in staging before the accompanying API is deployed.

alter table public.orders
  add column if not exists platform_fee_cents integer not null default 0
  check (platform_fee_cents in (0, 50));

create table if not exists public.platform_fee_ledger (
  order_id uuid primary key references public.orders(id),
  restaurant_id uuid not null references public.restaurants(id),
  amount_cents integer not null check (amount_cents = 50),
  state text not null default 'accrued'
    check (state in ('accrued','settled','reversed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  reversed_at timestamptz
);
create index if not exists platform_fee_restaurant_idx
  on public.platform_fee_ledger(restaurant_id,created_at desc);
alter table public.platform_fee_ledger enable row level security;
revoke all on public.platform_fee_ledger from anon,authenticated;
grant select,insert,update,delete on public.platform_fee_ledger to service_role;

-- Updating order state, courier earnings AND platform fee accrual is atomic.
-- A second "delivered" transition is forbidden: the fee can't accrue twice.
create or replace function public.courier_baitme_transition(
 p_courier_id uuid,p_order_id uuid,p_target text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v public.orders%rowtype;
begin
 if not exists(select 1 from public.courier_profiles
   where user_id=p_courier_id and approved=true)
 then raise exception 'courier not approved'; end if;

 select * into v from public.orders
  where id=p_order_id and courier_id=p_courier_id for update;
 if not found or v.payment_status<>'paid'
 then raise exception 'not assigned to paid order'; end if;
 if not ((v.status='ready_for_pickup' and p_target='picked_up') or
         (v.status='picked_up' and p_target='delivered'))
 then raise exception 'invalid courier transition'; end if;

 update public.orders set
  status=p_target,
  platform_fee_cents=case when p_target='delivered' then 50 else v.platform_fee_cents end,
  updated_at=now()
 where id=v.id;

 insert into public.order_events(order_id,actor_id,event_type,previous_status,next_status)
 values(v.id,p_courier_id,'courier_status',v.status,p_target);

 if p_target='delivered' then
   insert into public.courier_earnings(order_id,courier_id,amount_cents)
   values(v.id,p_courier_id,v.delivery_cents)
   on conflict(order_id) do nothing;

   insert into public.platform_fee_ledger(order_id,restaurant_id,amount_cents,state)
   values(v.id,v.restaurant_id,50,'accrued')
   on conflict(order_id) do nothing;
 end if;
 return v.id;
end; $$;

-- Prevent calling privileged SECURITY DEFINER function directly from clients.
revoke all on function public.courier_baitme_transition(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.courier_baitme_transition(uuid,uuid,text)
  to service_role;

-- Financial operations (fee settlement, refunds and transfers) must happen
-- only after verified Stripe webhooks, idempotency, liability accounting, and
-- invoice/VAT decisions. This SQL deliberately does not transfer any funds.
-- Restaurant settlement can be negative on tiny orders; NEVER make a negative
-- Stripe transfer: introduce restaurant balance/debt ledger and minimum order
-- rules before live launch.
