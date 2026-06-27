create or replace function public.profile_belongs_to_department(
  p_profile_id uuid,
  p_department_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employee_profile_departments membership
    where membership.profile_id = p_profile_id
      and membership.department_id = p_department_id
  )
  or exists (
    select 1
    from public.employee_profiles profile
    where profile.id = p_profile_id
      and profile.department_id = p_department_id
  );
$$;

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
    if not public.profile_belongs_to_department(profile_id, new.department_id) then
      raise exception 'Lead profile % is not assigned to the selected department', profile_id;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.validate_department_daily_lead()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.profile_belongs_to_department(new.lead_profile_id, new.department_id) then
    raise exception 'Daily lead must be assigned to the selected department';
  end if;
  return new;
end;
$$;

revoke all on function public.profile_belongs_to_department(uuid, uuid) from public, anon;
grant execute on function public.profile_belongs_to_department(uuid, uuid) to authenticated;

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

    if target_profile.id is null or not public.profile_belongs_to_department(profile_id_value, p_department_id) then
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

select pg_notify('pgrst', 'reload schema');
