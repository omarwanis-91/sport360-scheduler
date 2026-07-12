create or replace function public.save_admin_profile(
  p_profile_id uuid,
  p_employee_code text,
  p_email text,
  p_full_name text,
  p_title text,
  p_seniority_level text,
  p_department_ids uuid[],
  p_photo_url text,
  p_yearly_vacation_days integer,
  p_remaining_vacation_days integer,
  p_user_id uuid
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.employee_profiles;
  first_department_id uuid;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only Admins can update employee profiles';
  end if;

  if p_seniority_level not in ('junior', 'mid', 'senior', 'lead', 'manager') then
    raise exception 'Invalid seniority level';
  end if;

  select department_id into first_department_id
  from unnest(coalesce(p_department_ids, array[]::uuid[])) with ordinality selected_departments(department_id, ordinal)
  order by ordinal
  limit 1;

  update public.employee_profiles
  set
    employee_code = nullif(trim(p_employee_code), ''),
    email = nullif(trim(p_email), ''),
    full_name = nullif(trim(p_full_name), ''),
    title = nullif(trim(p_title), ''),
    seniority_level = p_seniority_level,
    department_id = first_department_id,
    photo_url = p_photo_url,
    yearly_vacation_days = greatest(coalesce(p_yearly_vacation_days, 0), 0),
    remaining_vacation_days = greatest(coalesce(p_remaining_vacation_days, 0), 0),
    user_id = p_user_id,
    updated_at = now()
  where id = p_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  delete from public.employee_profile_departments
  where profile_id = p_profile_id;

  insert into public.employee_profile_departments (profile_id, department_id)
  select p_profile_id, department_id
  from unnest(coalesce(p_department_ids, array[]::uuid[])) department_id
  where department_id is not null
  on conflict do nothing;

  return updated_profile;
end;
$$;

revoke all on function public.save_admin_profile(uuid, text, text, text, text, text, uuid[], text, integer, integer, uuid) from public, anon;
grant execute on function public.save_admin_profile(uuid, text, text, text, text, text, uuid[], text, integer, integer, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
