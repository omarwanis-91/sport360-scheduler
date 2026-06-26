create or replace function public.update_admin_profile(
  p_profile_id uuid,
  p_employee_code text,
  p_email text,
  p_full_name text,
  p_title text,
  p_seniority_level text,
  p_is_department_lead boolean,
  p_department_id uuid,
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
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only Admins can update employee profiles';
  end if;

  if p_seniority_level not in ('junior', 'mid', 'senior', 'lead', 'manager') then
    raise exception 'Invalid seniority level';
  end if;

  update public.employee_profiles
  set
    employee_code = nullif(trim(p_employee_code), ''),
    email = nullif(trim(p_email), ''),
    full_name = nullif(trim(p_full_name), ''),
    title = nullif(trim(p_title), ''),
    seniority_level = p_seniority_level,
    is_department_lead = coalesce(p_is_department_lead, false),
    department_id = p_department_id,
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

  return updated_profile;
end;
$$;

revoke all on function public.update_admin_profile(uuid, text, text, text, text, text, boolean, uuid, text, integer, integer, uuid) from public, anon;
grant execute on function public.update_admin_profile(uuid, text, text, text, text, text, boolean, uuid, text, integer, integer, uuid) to authenticated;
