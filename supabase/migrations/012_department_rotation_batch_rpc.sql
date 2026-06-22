create or replace function public.save_department_rotation_versions(
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
  pattern_entry jsonb;
  target_profile public.employee_profiles%rowtype;
  inserted_rotation public.rotation_versions%rowtype;
  profile_id_value uuid;
  pattern_value text[];
begin
  if auth.uid() is null or not public.is_claimed_user() then
    raise exception 'Authentication required';
  end if;

  if public.current_role() not in ('admin', 'lead') then
    raise exception 'Only Admins and Department Leads can save rotations';
  end if;

  if p_effective_start is null then
    raise exception 'Effective start is required';
  end if;

  if public.current_role() = 'lead' then
    if p_department_id is distinct from public.current_profile_department() then
      raise exception 'Department Leads can only edit their own department';
    end if;
    if p_effective_start < current_date then
      raise exception 'Department Leads cannot create past rotation versions';
    end if;
  end if;

  if jsonb_typeof(p_patterns_json) <> 'array' or jsonb_array_length(p_patterns_json) = 0 then
    raise exception 'At least one profile pattern is required';
  end if;

  if (
    select count(*) <> count(distinct entry->>'profileId')
    from jsonb_array_elements(p_patterns_json) entry
  ) then
    raise exception 'Each profile can appear only once';
  end if;

  for pattern_entry in select value from jsonb_array_elements(p_patterns_json)
  loop
    begin
      profile_id_value := (pattern_entry->>'profileId')::uuid;
    exception when others then
      raise exception 'Every pattern requires a valid profileId';
    end;

    select * into target_profile
    from public.employee_profiles
    where id = profile_id_value;

    if target_profile.id is null or target_profile.department_id is distinct from p_department_id then
      raise exception 'Profile % does not belong to the selected department', profile_id_value;
    end if;

    if jsonb_typeof(pattern_entry->'pattern') <> 'array'
      or jsonb_array_length(pattern_entry->'pattern') <> 7 then
      raise exception 'Profile % requires exactly seven weekday slots', profile_id_value;
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(pattern_entry->'pattern') status_id
      where status_id not in ('morning', 'midday', 'night', 'weekend')
    ) then
      raise exception 'Profile % contains a non-rotation status', profile_id_value;
    end if;

    if exists (
      select 1 from public.rotation_versions
      where profile_id = profile_id_value
        and effective_start = p_effective_start
    ) then
      raise exception 'Profile % already has a rotation version on %', profile_id_value, p_effective_start;
    end if;

    select array_agg(status_id order by ordinal)
    into pattern_value
    from jsonb_array_elements_text(pattern_entry->'pattern') with ordinality values_with_order(status_id, ordinal);

    insert into public.rotation_versions (profile_id, effective_start, pattern)
    values (profile_id_value, p_effective_start, pattern_value)
    returning * into inserted_rotation;

    return next inserted_rotation;
  end loop;
end;
$$;

revoke all on function public.save_department_rotation_versions(uuid, date, jsonb) from public, anon;
grant execute on function public.save_department_rotation_versions(uuid, date, jsonb) to authenticated;
