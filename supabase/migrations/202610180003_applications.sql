-- BaitMe admin and onboarding applications. Apply after 001 and 002.
create table if not exists public.platform_admins (
 user_id uuid primary key references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.restaurant_applications (
 id uuid primary key default gen_random_uuid(),
 applicant_id uuid not null references auth.users(id),
 name text not null check(length(name) between 2 and 120),
 slug text not null check(slug ~ '^[a-z0-9-]{3,60}$'),
 category text not null default 'Citi',
 description text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 restaurant_id uuid references public.restaurants(id),
 created_at timestamptz not null default now()
);
create unique index if not exists pending_restaurant_applications_uniq on public.restaurant_applications(applicant_id,slug) where status='pending';

create table if not exists public.courier_applications (
 id uuid primary key default gen_random_uuid(),
 applicant_id uuid not null references auth.users(id),
 display_name text not null check(length(display_name) between 2 and 120),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists pending_courier_applications_uniq on public.courier_applications(applicant_id) where status='pending';

alter table public.platform_admins enable row level security;
alter table public.restaurant_applications enable row level security;
alter table public.courier_applications enable row level security;
revoke all on public.platform_admins from anon,authenticated;
revoke all on public.restaurant_applications from anon,authenticated;
revoke all on public.courier_applications from anon,authenticated;
grant select,insert,update,delete on public.platform_admins to service_role;
grant select,insert,update,delete on public.restaurant_applications to service_role;
grant select,insert,update,delete on public.courier_applications to service_role;

-- Atomic admin-only approval: future onboarding/KYC still required before payout.
create or replace function public.approve_baitme_restaurant(p_admin uuid,p_application uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_app public.restaurant_applications%rowtype; v_restaurant uuid;
begin
 if not exists(select 1 from public.platform_admins where user_id=p_admin)
 then raise exception 'not platform admin'; end if;
 select * into v_app from public.restaurant_applications
  where id=p_application for update;
 if not found or v_app.status<>'pending' then raise exception 'application not pending'; end if;
 insert into public.restaurants(owner_user_id,slug,name,category,description,published)
 values(v_app.applicant_id,v_app.slug,v_app.name,v_app.category,v_app.description,false)
 returning id into v_restaurant;
 insert into public.restaurant_staff(restaurant_id,user_id,role)
 values(v_restaurant,v_app.applicant_id,'owner');
 update public.restaurant_applications set status='approved',reviewed_by=p_admin,
 reviewed_at=now(),restaurant_id=v_restaurant where id=p_application;
 return v_restaurant;
end; $$;

create or replace function public.approve_baitme_courier(p_admin uuid,p_application uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_app public.courier_applications%rowtype;
begin
 if not exists(select 1 from public.platform_admins where user_id=p_admin)
 then raise exception 'not platform admin'; end if;
 select * into v_app from public.courier_applications where id=p_application for update;
 if not found or v_app.status<>'pending' then raise exception 'application not pending'; end if;
 insert into public.courier_profiles(user_id,display_name,approved)
 values(v_app.applicant_id,v_app.display_name,false)
 on conflict (user_id) do update set display_name=excluded.display_name;
 update public.courier_applications set status='approved',reviewed_by=p_admin,reviewed_at=now()
 where id=p_application;
 return v_app.applicant_id;
end; $$;

revoke all on function public.approve_baitme_restaurant(uuid,uuid) from public,anon,authenticated;
revoke all on function public.approve_baitme_courier(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_baitme_restaurant(uuid,uuid) to service_role;
grant execute on function public.approve_baitme_courier(uuid,uuid) to service_role;

-- NB: approved courier application DOES NOT set courier_profiles.approved=true.
-- Operator must complete identity, contract and payment recipient checks separately.
-- approved restaurant application DOES NOT publish restaurant (requires verification).
