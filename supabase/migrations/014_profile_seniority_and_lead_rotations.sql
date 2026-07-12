alter table public.employee_profiles
  add column if not exists seniority_level text not null default 'mid',
  add column if not exists is_department_lead boolean not null default false;

alter table public.employee_profiles
  drop constraint if exists employee_profiles_seniority_level_check;

alter table public.employee_profiles
  add constraint employee_profiles_seniority_level_check
  check (seniority_level in ('junior', 'mid', 'senior', 'lead', 'manager'));

update public.employee_profiles profile
set
  is_department_lead = true,
  seniority_level = case
    when role.role = 'admin' then 'manager'
    else 'lead'
  end
from public.user_roles role
where role.user_id = profile.user_id
  and role.role in ('admin', 'lead');

update public.employee_profiles profile
set is_department_lead = true
where exists (
  select 1
  from public.department_daily_leads lead
  where lead.lead_profile_id = profile.id
);

create table if not exists public.department_lead_rotation_versions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  effective_start date not null,
  pattern jsonb not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(pattern) = 'array' and jsonb_array_length(pattern) = 7),
  unique (department_id, effective_start)
);

create or replace function public.validate_department_lead_rotation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  profile_id uuid;
begin
  for profile_id in
    select value::text::uuid
    from jsonb_array_elements_text(new.pattern)
  loop
    if not exists (
      select 1
      from public.employee_profiles profile
      where profile.id = profile_id
        and profile.department_id = new.department_id
        and profile.is_department_lead
    ) then
      raise exception 'Lead profile % is not eligible for the selected department', profile_id;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists validate_department_lead_rotation_trigger
  on public.department_lead_rotation_versions;

create trigger validate_department_lead_rotation_trigger
before insert or update on public.department_lead_rotation_versions
for each row execute function public.validate_department_lead_rotation();

create or replace function public.validate_department_daily_lead()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.employee_profiles profile
    where profile.id = new.lead_profile_id
      and profile.department_id = new.department_id
      and profile.is_department_lead
  ) then
    raise exception 'Daily lead must be an eligible profile in the selected department';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_department_daily_lead_trigger
  on public.department_daily_leads;

create trigger validate_department_daily_lead_trigger
before insert or update on public.department_daily_leads
for each row execute function public.validate_department_daily_lead();

alter table public.department_lead_rotation_versions enable row level security;

drop policy if exists "claimed users read lead rotations"
  on public.department_lead_rotation_versions;
create policy "claimed users read lead rotations"
on public.department_lead_rotation_versions
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "admins and leads manage lead rotations"
  on public.department_lead_rotation_versions;
create policy "admins and leads manage lead rotations"
on public.department_lead_rotation_versions
for all to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and department_id = public.current_profile_department()
    and effective_start >= current_date
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and department_id = public.current_profile_department()
    and effective_start >= current_date
  )
);
