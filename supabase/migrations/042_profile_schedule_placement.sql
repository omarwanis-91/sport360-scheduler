begin;

create table public.profile_schedule_placements (
  profile_id uuid primary key references public.employee_profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade
);
alter table public.profile_schedule_placements enable row level security;
revoke all on public.profile_schedule_placements from public, anon, authenticated;

create function public.get_profile_schedule_placements()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('enabled', true, 'placements', coalesce((
    select jsonb_agg(jsonb_build_object('profileId', p.profile_id, 'departmentId', p.department_id))
    from public.profile_schedule_placements p
    where auth.uid() is not null and public.is_claimed_user()
      and public.current_user_can_read_profile(p.profile_id)
      and public.current_user_can_access_department(p.department_id)
      and cardinality(public.profile_team_ids(p.profile_id)) > 1
      and p.department_id = any(public.profile_team_ids(p.profile_id))
  ), '[]'::jsonb));
$$;

-- Legacy profile saves replace membership rows inside their transaction. Check final membership.
create function public.clear_invalid_profile_schedule_placement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  teams uuid[];
begin
  if tg_table_name = 'employee_profiles' then target := old.id;
  else target := old.profile_id;
  end if;
  if exists (select 1 from public.profile_schedule_placements where profile_id = target) then
    teams := public.profile_team_ids(target);
    delete from public.profile_schedule_placements
      where profile_id = target and (cardinality(teams) < 2 or department_id <> all(teams));
  end if;
  return null;
end;
$$;

create constraint trigger clear_schedule_placement_after_membership_change
after update or delete on public.employee_profile_departments deferrable initially deferred
for each row execute function public.clear_invalid_profile_schedule_placement();
create constraint trigger clear_schedule_placement_after_anchor_change
after update on public.employee_profiles deferrable initially deferred
for each row when (old.department_id is distinct from new.department_id)
execute function public.clear_invalid_profile_schedule_placement();

-- Called by the profile save wrappers while their profile lock is held.
create function public.write_profile_schedule_placement(p_profile_id uuid, p_schedule_department_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  teams uuid[];
  previous uuid;
begin
  if auth.uid() is null or public.is_claimed_user() is not true
    or public.current_user_can_edit_profile_position(p_profile_id) is not true then
    raise exception 'Schedule placement requires management of all of this person''s teams.' using errcode = '42501';
  end if;
  teams := public.profile_team_ids(p_profile_id);
  if p_schedule_department_id is not null
    and (cardinality(teams) < 2 or p_schedule_department_id <> all(teams)) then
    raise exception 'Choose Hybrid or one of this person''s assigned teams.';
  end if;
  select department_id into previous from public.profile_schedule_placements where profile_id = p_profile_id;
  if previous is not distinct from p_schedule_department_id then return; end if;
  if p_schedule_department_id is null then
    delete from public.profile_schedule_placements where profile_id = p_profile_id;
  else
    insert into public.profile_schedule_placements(profile_id, department_id)
      values(p_profile_id, p_schedule_department_id)
      on conflict (profile_id) do update set department_id = excluded.department_id;
  end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, detail)
    values(auth.uid(), 'profile.schedule_placement_updated', 'profile', p_profile_id::text,
      jsonb_build_object('previous_department_id', previous, 'department_id', p_schedule_department_id));
end;
$$;

create function public.save_admin_profile_with_schedule_placement(
  p_profile_id uuid, p_employee_code text, p_email text, p_full_name text, p_title text, p_seniority_level text,
  p_department_ids uuid[], p_photo_url text, p_yearly_vacation_days integer, p_remaining_vacation_days integer, p_user_id uuid,
  p_expected_balance_year integer, p_expected_allowance integer, p_expected_remaining integer, p_schedule_department_id uuid
) returns public.employee_profiles language plpgsql security definer set search_path = public as $$
declare saved public.employee_profiles;
begin
  saved := public.save_admin_profile_annual(
    p_profile_id, p_employee_code, p_email, p_full_name, p_title, p_seniority_level, p_department_ids,
    p_photo_url, p_yearly_vacation_days, p_remaining_vacation_days, p_user_id,
    p_expected_balance_year, p_expected_allowance, p_expected_remaining
  );
  perform public.write_profile_schedule_placement(p_profile_id, p_schedule_department_id);
  return saved;
end;
$$;

create function public.create_admin_team_profile_with_schedule_placement(
  p_profile_id uuid, p_email text, p_full_name text, p_seniority_level text, p_department_ids uuid[], p_photo_url text,
  p_yearly_vacation_days integer, p_remaining_vacation_days integer, p_schedule_department_id uuid
) returns public.employee_profiles language plpgsql security definer set search_path = public as $$
declare saved public.employee_profiles;
begin
  saved := public.create_admin_team_profile(p_profile_id, p_email, p_full_name, p_seniority_level, p_department_ids,
    p_photo_url, p_yearly_vacation_days, p_remaining_vacation_days);
  perform public.write_profile_schedule_placement(p_profile_id, p_schedule_department_id);
  return saved;
end;
$$;

create function public.save_managed_profile_with_schedule_placement(
  p_profile_id uuid, p_seniority_level text, p_department_ids uuid[], p_full_name text, p_photo_url text,
  p_schedule_department_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare saved jsonb;
begin
  perform public.lock_profile_structure(p_profile_id);
  if auth.uid() is null or public.is_claimed_user() is not true
    or public.current_user_can_edit_profile_position(p_profile_id) is not true then
    raise exception 'Schedule placement requires management of all of this person''s teams.' using errcode = '42501';
  end if;
  saved := public.save_managed_profile_structure(p_profile_id, p_seniority_level, p_department_ids, p_full_name, p_photo_url);
  perform public.write_profile_schedule_placement(p_profile_id, p_schedule_department_id);
  return saved;
end;
$$;

revoke all on function public.write_profile_schedule_placement(uuid, uuid),
  public.clear_invalid_profile_schedule_placement(), public.get_profile_schedule_placements(),
  public.save_admin_profile_with_schedule_placement(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer,uuid),
  public.create_admin_team_profile_with_schedule_placement(uuid,text,text,text,uuid[],text,integer,integer,uuid),
  public.save_managed_profile_with_schedule_placement(uuid,text,uuid[],text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.get_profile_schedule_placements(),
  public.save_admin_profile_with_schedule_placement(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer,uuid),
  public.create_admin_team_profile_with_schedule_placement(uuid,text,text,text,uuid[],text,integer,integer,uuid),
  public.save_managed_profile_with_schedule_placement(uuid,text,uuid[],text,text,uuid)
  to authenticated;

notify pgrst, 'reload schema';
commit;
