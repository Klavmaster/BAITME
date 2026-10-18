-- BaitMe v4: delivery location, customer complaints and refund decision workflow.
-- 2026-10-18. Payments and Stripe refunds remain disabled until verified integrations.
-- Apply after migrations 001..003 in staging, then production only after review.

-- Stripe processing costs are borne commercially by the restaurant, never the
-- customer as a prohibited card surcharge. This is a reconciliation placeholder;
-- only verified Stripe balance transaction amounts can populate this column.
alter table public.orders add column if not exists restaurant_processing_fee_cents integer not null default 0
 check (restaurant_processing_fee_cents between 0 and food_cents);

create table if not exists public.complaint_cases (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id),
 customer_id uuid not null references auth.users(id),
 restaurant_id uuid not null references public.restaurants(id),
 category text not null check (category in ('missing_item','wrong_item','quality','delivery_issue','other')),
 customer_description text not null check (length(customer_description) between 15 and 2000),
 requested_refund_cents integer not null check(requested_refund_cents>0),
 status text not null default 'awaiting_restaurant'
   check(status in ('awaiting_restaurant','under_review','approved_pending_refund','rejected','refund_submitted','refunded','refund_failed')),
 restaurant_response text,
 restaurant_recommended_cents integer check(restaurant_recommended_cents>=0),
 restaurant_responded_by uuid references auth.users(id),
 restaurant_responded_at timestamptz,
 reviewed_by uuid references auth.users(id),
 review_note text,
 approved_refund_cents integer check(approved_refund_cents>0),
 reviewed_at timestamptz,
 stripe_refund_id text unique,
 refund_submitted_at timestamptz,
 refund_completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists complaint_restaurant_status_idx
 on public.complaint_cases(restaurant_id,status,created_at desc);
create index if not exists complaint_customer_idx on public.complaint_cases(customer_id,created_at desc);
create index if not exists complaint_admin_status_idx on public.complaint_cases(status,created_at desc);
alter table public.complaint_cases enable row level security;
revoke all on public.complaint_cases from anon,authenticated;
grant select,insert,update,delete on public.complaint_cases to service_role;

-- Only one latest point is stored per active assignment, rather than an
-- indefinite route history. Never query this table from a public client.
create table if not exists public.courier_live_locations (
 order_id uuid primary key references public.orders(id) on delete cascade,
 courier_id uuid not null references public.courier_profiles(user_id),
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 accuracy_m double precision not null check (accuracy_m between 0 and 1000),
 updated_at timestamptz not null default now()
);
create index if not exists courier_live_locations_expiry_idx on public.courier_live_locations(updated_at);
alter table public.courier_live_locations enable row level security;
revoke all on public.courier_live_locations from anon,authenticated;
grant select,insert,update,delete on public.courier_live_locations to service_role;

-- Customer can open exactly one complaint per verified paid order.
-- This first version supports restaurant-food refunds up to the food amount.
create or replace function public.create_baitme_complaint(
 p_customer_id uuid,p_order_id uuid,p_category text,p_description text,p_amount_cents integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_case_id uuid;
begin
 select * into v_order from public.orders where id=p_order_id for share;
 if not found or v_order.customer_id<>p_customer_id then raise exception 'order not found'; end if;
 if v_order.payment_status not in ('paid','partially_refunded')
 then raise exception 'only paid orders may be complained about'; end if;
 if p_category not in ('missing_item','wrong_item','quality','delivery_issue','other')
 or length(trim(coalesce(p_description,''))) not between 15 and 2000
 or p_amount_cents is null or p_amount_cents<1 or p_amount_cents>v_order.food_cents
 then raise exception 'invalid complaint'; end if;
 insert into public.complaint_cases(order_id,customer_id,restaurant_id,category,customer_description,requested_refund_cents)
 values(v_order.id,p_customer_id,v_order.restaurant_id,p_category,trim(p_description),p_amount_cents)
 returning id into v_case_id;
 return v_case_id;
end; $$;

-- Restaurant submits its account and proposes a refund amount. It cannot
-- approve or execute a Stripe refund.
create or replace function public.respond_baitme_complaint(
 p_actor_id uuid,p_restaurant_id uuid,p_case_id uuid,p_response text,p_recommended_cents integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_case public.complaint_cases%rowtype; v_food integer;
begin
 if not exists(select 1 from public.restaurant_staff
    where restaurant_id=p_restaurant_id and user_id=p_actor_id)
 then raise exception 'restaurant access denied'; end if;
 select * into v_case from public.complaint_cases
   where id=p_case_id and restaurant_id=p_restaurant_id for update;
 if not found or v_case.status<>'awaiting_restaurant' then raise exception 'not awaiting restaurant'; end if;
 select food_cents into v_food from public.orders where id=v_case.order_id;
 if length(trim(coalesce(p_response,''))) not between 10 and 2000
 or p_recommended_cents is null or p_recommended_cents<0 or p_recommended_cents>v_food
 then raise exception 'invalid response'; end if;
 update public.complaint_cases set restaurant_response=trim(p_response),
  restaurant_recommended_cents=p_recommended_cents,restaurant_responded_by=p_actor_id,
  restaurant_responded_at=now(),status='under_review',updated_at=now()
  where id=p_case_id;
 return p_case_id;
end; $$;

-- Admin's approval is an instruction to run an eventual verified Stripe refund.
-- NEVER mark customer money returned until a signed/verified Stripe event.
create or replace function public.review_baitme_complaint(
 p_admin_id uuid,p_case_id uuid,p_approve boolean,p_amount_cents integer,p_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_case public.complaint_cases%rowtype; v_order public.orders%rowtype;
begin
 if not exists(select 1 from public.platform_admins where user_id=p_admin_id)
 then raise exception 'platform admin required'; end if;
 select * into v_case from public.complaint_cases where id=p_case_id for update;
 if not found or v_case.status<>'under_review' then raise exception 'case is not ready'; end if;
 select * into v_order from public.orders where id=v_case.order_id for update;
 if v_order.payment_status not in ('paid','partially_refunded')
 then raise exception 'no paid order to refund'; end if;
 if length(trim(coalesce(p_note,''))) not between 10 and 2000
 then raise exception 'review note required'; end if;
 if p_approve and (p_amount_cents is null or p_amount_cents<1 or p_amount_cents>v_order.food_cents)
 then raise exception 'refund amount exceeds food amount'; end if;
 update public.complaint_cases set
  status=case when p_approve then 'approved_pending_refund' else 'rejected' end,
  approved_refund_cents=case when p_approve then p_amount_cents else null end,
  reviewed_by=p_admin_id,review_note=trim(p_note),reviewed_at=now(),updated_at=now()
 where id=p_case_id;
 return p_case_id;
end; $$;

-- Protect privileged functions: service role only, API actor IDs verified.
revoke all on function public.create_baitme_complaint(uuid,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.respond_baitme_complaint(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.review_baitme_complaint(uuid,uuid,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.create_baitme_complaint(uuid,uuid,text,text,integer) to service_role;
grant execute on function public.respond_baitme_complaint(uuid,uuid,uuid,text,integer) to service_role;
grant execute on function public.review_baitme_complaint(uuid,uuid,boolean,integer,text) to service_role;

-- Privacy housekeeping: deployment scheduler must run this as service role
-- regularly (e.g. every hour). Tracking stops immediately in client on revoke
-- and server delete endpoint removes point. Also discard expired / completed.
create or replace function public.purge_expired_baitme_locations()
returns integer language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
 delete from public.courier_live_locations l
 using public.orders o
 where o.id=l.order_id and (
   l.updated_at<now()-interval '15 minutes'
   or o.status not in ('ready_for_pickup','picked_up')
   or o.courier_id<>l.courier_id
   or o.payment_status<>'paid'
 );
 get diagnostics removed=row_count;
 return removed;
end; $$;
revoke all on function public.purge_expired_baitme_locations() from public,anon,authenticated;
grant execute on function public.purge_expired_baitme_locations() to service_role;
