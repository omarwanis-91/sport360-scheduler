-- Direct edits and department paste share one authorized, atomic write.
create or replace function public.apply_rotation_patterns(
  p_department_id uuid,
  p_effective_start date,
  p_patterns_json jsonb
)
returns setof public.rotation_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  entry jsonb;
  target_profile_id uuid;
  target_rotation_id uuid;
  pattern_value text[];
  saved_rotation public.rotation_versions%rowtype;
begin
  if auth.uid() is null or not public.is_claimed_user() then
    raise exception 'Authentication required';
  end if;

  if public.current_role() is null or public.current_role() not in ('admin', 'lead')
    or not public.current_user_can_manage_department(p_department_id)
  then
    raise exception 'You can only save rotations inside your department';
  end if;

  if p_effective_start is null then
    raise exception 'Effective start is required';
  end if;
  if public.current_role() = 'lead' and p_effective_start < current_date then
    raise exception 'Department Leads cannot change past rotation versions';
  end if;

  if jsonb_typeof(p_patterns_json) is distinct from 'array' then
    raise exception 'Patterns must be an array';
  end if;
  if jsonb_array_length(p_patterns_json) = 0 then
    raise exception 'At least one profile pattern is required';
  end if;
  if (
    select count(*) <> count(distinct item->>'profileId')
    from jsonb_array_elements(p_patterns_json) item
  ) then
    raise exception 'Each profile must appear exactly once';
  end if;

  -- Lock in a stable order, serializing direct edits and overlapping pastes.
  perform 1
  from public.employee_profiles profile
  where profile.id in (
    select (item->>'profileId')::uuid
    from jsonb_array_elements(p_patterns_json) item
  )
  order by profile.id
  for update;

  for entry in select value from jsonb_array_elements(p_patterns_json)
  loop
    target_profile_id := (entry->>'profileId')::uuid;
    if not exists (select 1 from public.employee_profiles where id = target_profile_id) then
      raise exception 'Employee profile not found';
    end if;

    if public.current_role() = 'lead'
      and not public.profile_directly_belongs_to_department(target_profile_id, p_department_id)
    then
      raise exception 'Department Leads can rotate only direct members of their department';
    end if;
    if public.current_role() = 'admin'
      and not public.profile_belongs_to_department(target_profile_id, p_department_id)
    then
      raise exception 'Profile does not belong to the selected department scope';
    end if;

    if jsonb_typeof(entry->'pattern') is distinct from 'array' then
      raise exception 'Each pattern must be an array';
    end if;
    if jsonb_array_length(entry->'pattern') <> 7 then
      raise exception 'Each pattern requires exactly seven weekday slots';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(entry->'pattern') status_id
      where status_id is null or status_id not in ('morning', 'midday', 'night', 'weekend')
    ) then
      raise exception 'Patterns can contain only rotational shifts';
    end if;

    if (select count(*) from public.rotation_versions
        where profile_id = target_profile_id and effective_start = p_effective_start) > 1
    then
      raise exception 'Multiple versions exist for this person and date; resolve them before editing';
    end if;

    select array_agg(status_id order by ordinal)
    into pattern_value
    from jsonb_array_elements_text(entry->'pattern')
      with ordinality slots(status_id, ordinal);

    select id into target_rotation_id
    from public.rotation_versions
    where profile_id = target_profile_id and effective_start = p_effective_start;

    if target_rotation_id is null then
      insert into public.rotation_versions (profile_id, effective_start, pattern, created_by)
      values (target_profile_id, p_effective_start, pattern_value, auth.uid())
      returning * into saved_rotation;
    else
      update public.rotation_versions
      set pattern = pattern_value
      where id = target_rotation_id
      returning * into saved_rotation;
    end if;
    return next saved_rotation;
  end loop;
end;
$$;

revoke all on function public.apply_rotation_patterns(uuid, date, jsonb) from public, anon;
grant execute on function public.apply_rotation_patterns(uuid, date, jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');
