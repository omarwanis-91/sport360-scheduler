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

drop function if exists public.update_own_profile(uuid, text, text);

create or replace function public.update_own_profile(
  p_profile_id uuid,
  p_full_name text,
  p_photo_url text,
  p_title text
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.employee_profiles;
begin
  update public.employee_profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    title = nullif(trim(p_title), ''),
    photo_url = p_photo_url,
    updated_at = now()
  where id = p_profile_id
    and user_id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found or not owned by current user';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.update_own_profile(uuid, text, text, text) from public;
grant execute on function public.update_own_profile(uuid, text, text, text) to authenticated;
