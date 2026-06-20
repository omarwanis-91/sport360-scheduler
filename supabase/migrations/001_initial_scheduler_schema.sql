create extension if not exists "pgcrypto";

create type app_role as enum ('admin', 'lead', 'employee');
create type status_kind as enum ('working', 'off', 'leave');
create type vacation_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'employee',
  created_at timestamptz not null default now()
);

create table public.employee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  department_id uuid not null references public.departments(id),
  employee_code text not null unique,
  email text not null unique,
  full_name text not null,
  title text not null,
  photo_url text,
  yearly_vacation_days integer not null default 21 check (yearly_vacation_days >= 0),
  remaining_vacation_days integer not null default 21 check (remaining_vacation_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shift_statuses (
  id text primary key,
  label text not null,
  kind status_kind not null,
  color text not null default '#991b1b',
  icon text,
  sort_order integer not null default 100
);

create table public.rotation_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  effective_start date not null,
  pattern text[] not null check (array_length(pattern, 1) > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  shift_date date not null,
  status_id text not null references public.shift_statuses(id),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, shift_date)
);

create table public.department_daily_leads (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  lead_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  lead_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (department_id, lead_date)
);

create table public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status vacation_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  deducted_days integer not null default 0 check (deducted_days >= 0),
  check (end_date >= start_date)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.shift_statuses (id, label, kind, color, icon, sort_order) values
  ('morning', 'Morning', 'working', '#f59e0b', 'sun', 10),
  ('night', 'Night', 'working', '#6366f1', 'moon', 20),
  ('midday', 'Mid-day', 'working', '#f97316', 'sun-high', 30),
  ('weekend', 'Weekend', 'off', '#71717a', 'off', 40),
  ('vacation', 'Vacation', 'leave', '#14b8a6', 'palm', 50),
  ('sick', 'Sick', 'leave', '#e11d48', 'cross', 60),
  ('ground', 'On Ground', 'working', '#0f766e', 'pin', 70);

alter table public.departments enable row level security;
alter table public.user_roles enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.shift_statuses enable row level security;
alter table public.rotation_versions enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.department_daily_leads enable row level security;
alter table public.vacation_requests enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.current_role()
returns app_role
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'employee'::app_role);
$$;

create or replace function public.current_profile_department()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select department_id from public.employee_profiles where user_id = auth.uid();
$$;

create or replace function public.claim_profile_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_profile_id uuid;
begin
  update public.employee_profiles
  set user_id = auth.uid(), updated_at = now()
  where user_id is null
    and lower(email) = lower((select email from auth.users where id = auth.uid()))
  returning id into claimed_profile_id;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'employee')
  on conflict (user_id) do nothing;

  return claimed_profile_id;
end;
$$;

grant execute on function public.claim_profile_for_current_user() to authenticated;

create policy "authenticated can read departments" on public.departments for select to authenticated using (true);
create policy "admins manage departments" on public.departments for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "authenticated can read statuses" on public.shift_statuses for select to authenticated using (true);
create policy "admins manage statuses" on public.shift_statuses for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "users read own role" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.current_role() = 'admin');
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "profiles visible to authenticated" on public.employee_profiles for select to authenticated using (true);
create policy "admins manage profiles" on public.employee_profiles for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "authenticated read rotations" on public.rotation_versions for select to authenticated using (true);
create policy "admins and leads manage department rotations" on public.rotation_versions
for all to authenticated
using (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.employee_profiles p
    where p.id = rotation_versions.profile_id
      and p.department_id = public.current_profile_department()
      and public.current_role() = 'lead'
  )
)
with check (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.employee_profiles p
    where p.id = rotation_versions.profile_id
      and p.department_id = public.current_profile_department()
      and public.current_role() = 'lead'
  )
);

create policy "authenticated read schedule overrides" on public.schedule_overrides for select to authenticated using (true);
create policy "admins and leads manage future overrides" on public.schedule_overrides
for all to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and shift_date >= current_date
    and exists (
      select 1 from public.employee_profiles p
      where p.id = schedule_overrides.profile_id
        and p.department_id = public.current_profile_department()
    )
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and shift_date >= current_date
    and exists (
      select 1 from public.employee_profiles p
      where p.id = schedule_overrides.profile_id
        and p.department_id = public.current_profile_department()
    )
  )
);

create policy "authenticated read daily leads" on public.department_daily_leads for select to authenticated using (true);
create policy "admins and leads manage daily leads" on public.department_daily_leads
for all to authenticated
using (public.current_role() = 'admin' or (public.current_role() = 'lead' and department_id = public.current_profile_department()))
with check (public.current_role() = 'admin' or (public.current_role() = 'lead' and department_id = public.current_profile_department()));

create policy "vacation visible to owner lead or admin" on public.vacation_requests
for select to authenticated
using (
  public.current_role() = 'admin'
  or exists (select 1 from public.employee_profiles p where p.id = vacation_requests.profile_id and p.user_id = auth.uid())
  or (
    public.current_role() = 'lead'
    and exists (
      select 1 from public.employee_profiles p
      where p.id = vacation_requests.profile_id
        and p.department_id = public.current_profile_department()
    )
  )
);

create policy "employees create own vacation requests" on public.vacation_requests
for insert to authenticated
with check (exists (select 1 from public.employee_profiles p where p.id = profile_id and p.user_id = auth.uid()));

create policy "admins and leads create vacation requests" on public.vacation_requests
for insert to authenticated
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and exists (
      select 1 from public.employee_profiles p
      where p.id = profile_id
        and p.department_id = public.current_profile_department()
    )
  )
);

create policy "admins and leads decide vacation requests" on public.vacation_requests
for update to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and exists (
      select 1 from public.employee_profiles p
      where p.id = vacation_requests.profile_id
        and p.department_id = public.current_profile_department()
    )
  )
);

create policy "admins read audit" on public.audit_log for select to authenticated using (public.current_role() = 'admin');
create policy "authenticated create audit" on public.audit_log for insert to authenticated with check (actor_id = auth.uid());
