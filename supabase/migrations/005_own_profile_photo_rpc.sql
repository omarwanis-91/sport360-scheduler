create or replace function public.update_own_profile(p_profile_id uuid, p_full_name text, p_photo_url text)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.employee_profiles;
begin
  update public.employee_profiles
  set full_name = trim(p_full_name),
      photo_url = nullif(p_photo_url, ''),
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

grant execute on function public.update_own_profile(uuid, text, text) to authenticated;
