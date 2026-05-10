create extension if not exists pgcrypto;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#7aa2d6',
  manager_enabled boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.departments is 'Configurable teams shown in the scheduler.';

create table public.shift_types (
  id text primary key,
  label text not null,
  color text not null,
  counts_as_vacation boolean not null default false,
  counts_as_sick boolean not null default false,
  default_eligible boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true
);

comment on table public.shift_types is 'Configurable shift labels, colors, and accounting behavior.';

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null default 'Team Member',
  department_id uuid references public.departments(id) on delete set null,
  vacation_limit integer not null default 15 check (vacation_limit >= 0),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_defaults (
  person_id uuid not null references public.people(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  shift_type_id text not null references public.shift_types(id),
  primary key (person_id, weekday)
);

create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  shift_date date not null,
  shift_type_id text not null references public.shift_types(id),
  source text not null default 'admin' check (source in ('admin', 'request')),
  request_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (person_id, shift_date)
);

create table public.manager_defaults (
  department_id uuid not null references public.departments(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  person_id uuid references public.people(id) on delete set null,
  primary key (department_id, weekday)
);

create table public.manager_overrides (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  manager_date date not null,
  person_id uuid references public.people(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (department_id, manager_date)
);

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('vacation', 'sick')),
  start_date date not null,
  end_date date not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.schedule_overrides
  add constraint schedule_overrides_request_fk
  foreign key (request_id) references public.time_off_requests(id) on delete set null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_people_updated_at
before update on public.people
for each row execute function public.touch_updated_at();

create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger touch_time_off_requests_updated_at
before update on public.time_off_requests
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.owns_person(target_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and person_id = target_person_id
  );
$$;

alter table public.departments enable row level security;
alter table public.shift_types enable row level security;
alter table public.people enable row level security;
alter table public.profiles enable row level security;
alter table public.person_defaults enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.manager_defaults enable row level security;
alter table public.manager_overrides enable row level security;
alter table public.time_off_requests enable row level security;

create policy "signed in users read departments" on public.departments
  for select to authenticated using (true);
create policy "admins manage departments" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "signed in users read shifts" on public.shift_types
  for select to authenticated using (true);
create policy "admins manage shifts" on public.shift_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "signed in users read people" on public.people
  for select to authenticated using (true);
create policy "admins manage people" on public.people
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users read own profile or admins read all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "signed in users read defaults" on public.person_defaults
  for select to authenticated using (true);
create policy "admins manage defaults" on public.person_defaults
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "signed in users read overrides" on public.schedule_overrides
  for select to authenticated using (true);
create policy "admins manage overrides" on public.schedule_overrides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "signed in users read manager defaults" on public.manager_defaults
  for select to authenticated using (true);
create policy "admins manage manager defaults" on public.manager_defaults
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "signed in users read manager overrides" on public.manager_overrides
  for select to authenticated using (true);
create policy "admins manage manager overrides" on public.manager_overrides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users read own requests or admins read all" on public.time_off_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "users create own requests" on public.time_off_requests
  for insert to authenticated with check (user_id = auth.uid() and public.owns_person(person_id));
create policy "admins update requests" on public.time_off_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
