create table if not exists public.employee_profile_departments (
  profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, department_id)
);

insert into public.employee_profile_departments (profile_id, department_id)
select id, department_id
from public.employee_profiles
where department_id is not null
on conflict do nothing;

alter table public.employee_profile_departments enable row level security;

drop policy if exists "claimed users read profile departments"
  on public.employee_profile_departments;
create policy "claimed users read profile departments"
on public.employee_profile_departments
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "admins manage profile departments"
  on public.employee_profile_departments;
create policy "admins manage profile departments"
on public.employee_profile_departments
for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

select pg_notify('pgrst', 'reload schema');
