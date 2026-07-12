create or replace function public.delete_admin_profile(
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only Admins can delete employee profiles';
  end if;

  select user_id into target_user_id
  from public.employee_profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  delete from public.department_lead_rotation_versions
  where pattern ? p_profile_id::text;

  if target_user_id is not null then
    delete from public.user_roles
    where user_id = target_user_id;
  end if;

  delete from public.employee_profiles
  where id = p_profile_id;
end;
$$;

revoke all on function public.delete_admin_profile(uuid) from public, anon;
grant execute on function public.delete_admin_profile(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
