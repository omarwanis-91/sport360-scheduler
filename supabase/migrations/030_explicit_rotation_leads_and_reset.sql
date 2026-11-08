-- Empty lead slots stay explicitly unassigned; never pick a member implicitly.
create or replace function public.validate_department_lead_rotation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  slot text;
  profile_id uuid;
begin
  for slot in select value from jsonb_array_elements_text(new.pattern)
  loop
    if slot is null or slot = '' then continue; end if;
    profile_id := slot::uuid;
    if public.current_role() = 'lead'
      and not public.profile_directly_belongs_to_department(profile_id, new.department_id)
    then
      raise exception 'Lead assignments must stay inside your department';
    end if;
    if public.current_role() <> 'lead'
      and not public.profile_belongs_to_department(profile_id, new.department_id)
    then
      raise exception 'Lead profile is not assigned to the selected department scope';
    end if;
  end loop;
  return new;
end;
$$;

-- Save one person's weekday shifts and explicit Lead choices together.
create or replace function public.save_person_rotation(
  p_department_id uuid,
  p_profile_id uuid,
  p_effective_start date,
  p_pattern text[],
  p_lead_days boolean[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_rotation public.rotation_versions%rowtype;
  base_lead public.department_lead_rotation_versions%rowtype;
  saved_lead public.department_lead_rotation_versions%rowtype;
  lead_pattern jsonb;
  previous_pattern jsonb;
  day_index integer;
begin
  if auth.uid() is null or not public.is_claimed_user()
    or public.current_role() is null or public.current_role() not in ('admin', 'lead')
    or not public.current_user_can_manage_department(p_department_id)
  then raise exception 'Not allowed to save this rotation'; end if;

  if coalesce(array_length(p_lead_days, 1), 0) <> 7
    or array_ndims(p_lead_days) <> 1 or array_lower(p_lead_days, 1) <> 1
    or array_position(p_lead_days, null) is not null
  then raise exception 'Exactly seven explicit Lead choices are required'; end if;
  for day_index in 1..7 loop
    if p_lead_days[day_index] and p_pattern[day_index] not in ('morning', 'midday', 'night') then
      raise exception 'Lead requires a working day';
    end if;
  end loop;

  -- Serialize lead changes for different people in the same department.
  perform 1 from public.departments where id = p_department_id for update;
  select * into saved_rotation
  from public.apply_rotation_patterns(
    p_department_id, p_effective_start,
    jsonb_build_array(jsonb_build_object('profileId', p_profile_id, 'pattern', p_pattern))
  );

  select * into base_lead from public.department_lead_rotation_versions
  where department_id = p_department_id and effective_start <= p_effective_start
  order by effective_start desc limit 1;
  previous_pattern := coalesce(base_lead.pattern, '["", "", "", "", "", "", ""]'::jsonb);
  lead_pattern := previous_pattern;
  for day_index in 1..7 loop
    if p_lead_days[day_index] then
      lead_pattern := jsonb_set(lead_pattern, array[(day_index - 1)::text], to_jsonb(p_profile_id::text));
    elsif lead_pattern->>(day_index - 1) = p_profile_id::text then
      lead_pattern := jsonb_set(lead_pattern, array[(day_index - 1)::text], '""'::jsonb);
    end if;
  end loop;

  if lead_pattern is distinct from previous_pattern then
    insert into public.department_lead_rotation_versions (department_id, effective_start, pattern, created_by)
    values (p_department_id, p_effective_start, lead_pattern, auth.uid())
    on conflict (department_id, effective_start) do update set pattern = excluded.pattern
    returning * into saved_lead;
  end if;
  return jsonb_build_object('rotation', to_jsonb(saved_rotation), 'lead_rotation',
    case when saved_lead.id is not null then to_jsonb(saved_lead) else null end);
end;
$$;

-- A full person reset is Admin-only because it removes historical versions too.
create or replace function public.reset_person_rotation(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
  changed_lead_count integer;
begin
  if auth.uid() is null or not public.is_claimed_user()
    or public.current_role() is distinct from 'admin'
  then raise exception 'Only Admin can reset all rotation versions'; end if;

  -- Match the lock order of person saves before cleaning shared lead patterns.
  perform 1 from public.departments department
  where exists (select 1 from public.department_lead_rotation_versions lead
    where lead.department_id = department.id and lead.pattern ? p_profile_id::text)
    or public.profile_belongs_to_department(p_profile_id, department.id)
  order by department.id for update;
  perform 1 from public.employee_profiles where id = p_profile_id for update;
  if not found then raise exception 'Employee profile not found'; end if;

  delete from public.rotation_versions where profile_id = p_profile_id;
  get diagnostics removed_count = row_count;
  update public.department_lead_rotation_versions lead
  set pattern = (
    select jsonb_agg(case when slot.value = p_profile_id::text then '' else coalesce(slot.value, '') end order by slot.ordinal)
    from jsonb_array_elements_text(lead.pattern) with ordinality slot(value, ordinal)
  )
  where lead.pattern ? p_profile_id::text;
  get diagnostics changed_lead_count = row_count;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'rotation.reset', 'profile', p_profile_id::text,
    jsonb_build_object('rotation_versions_removed', removed_count, 'weekly_lead_versions_cleaned', changed_lead_count));
  return jsonb_build_object('removed_versions', removed_count, 'cleaned_lead_versions', changed_lead_count);
end;
$$;

revoke all on function public.save_person_rotation(uuid, uuid, date, text[], boolean[]) from public, anon;
revoke all on function public.reset_person_rotation(uuid) from public, anon;
grant execute on function public.save_person_rotation(uuid, uuid, date, text[], boolean[]) to authenticated;
grant execute on function public.reset_person_rotation(uuid) to authenticated;
select pg_notify('pgrst', 'reload schema');
