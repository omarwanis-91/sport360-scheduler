create or replace function public.is_claimed_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employee_profiles
    where user_id = auth.uid()
  );
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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into claimed_profile_id
  from public.employee_profiles
  where user_id = auth.uid();

  if claimed_profile_id is null then
    update public.employee_profiles
    set user_id = auth.uid(), updated_at = now()
    where user_id is null
      and lower(email) = lower((select email from auth.users where id = auth.uid()))
    returning id into claimed_profile_id;
  end if;

  if claimed_profile_id is null then
    raise exception 'No employee profile matches this account';
  end if;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'employee')
  on conflict (user_id) do nothing;

  return claimed_profile_id;
end;
$$;

drop policy if exists "authenticated can read departments" on public.departments;
create policy "claimed users can read departments" on public.departments
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "authenticated can read statuses" on public.shift_statuses;
create policy "claimed users can read statuses" on public.shift_statuses
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "profiles visible to authenticated" on public.employee_profiles;
create policy "profiles visible to claimed users" on public.employee_profiles
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "authenticated read rotations" on public.rotation_versions;
create policy "claimed users read rotations" on public.rotation_versions
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "authenticated read schedule overrides" on public.schedule_overrides;
create policy "claimed users read schedule overrides" on public.schedule_overrides
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "authenticated read daily leads" on public.department_daily_leads;
create policy "claimed users read daily leads" on public.department_daily_leads
for select to authenticated
using (public.is_claimed_user());

drop policy if exists "authenticated create audit" on public.audit_log;
create policy "claimed users create audit" on public.audit_log
for insert to authenticated
with check (actor_id = auth.uid() and public.is_claimed_user());

revoke all on function public.current_role() from public, anon;
revoke all on function public.current_profile_department() from public, anon;
revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.is_claimed_user() from public, anon;
revoke all on function public.claim_profile_for_current_user() from public, anon;
revoke all on function public.update_own_profile_name(uuid, text) from public, anon;
revoke all on function public.update_own_profile(uuid, text, text) from public, anon;
revoke all on function public.vacation_workday_count(uuid, date, date) from public, anon;
revoke all on function public.decide_vacation_request(uuid, vacation_status) from public, anon;
revoke all on function public.apply_vacation_overrides(uuid, date, date, uuid) from public, anon, authenticated;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_profile_department() to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_claimed_user() to authenticated;
grant execute on function public.claim_profile_for_current_user() to authenticated;
grant execute on function public.update_own_profile_name(uuid, text) to authenticated;
grant execute on function public.update_own_profile(uuid, text, text) to authenticated;
grant execute on function public.vacation_workday_count(uuid, date, date) to authenticated;
grant execute on function public.decide_vacation_request(uuid, vacation_status) to authenticated;

