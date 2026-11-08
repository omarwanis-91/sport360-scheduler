-- Require explicit review before backdated changes can be superseded by later versions.
create or replace function public.save_rotation_drafts(p_department_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entry jsonb;
  target_id uuid;
  start_date date;
  action_name text;
  source_row public.rotation_versions%rowtype;
  previous_leads jsonb;
  pattern_value text[];
  lead_days boolean[];
  saved jsonb;
  saved_rows jsonb := '[]'::jsonb;
  reset_ids jsonb := '[]'::jsonb;
  future_snapshot jsonb;
  future_policy text;
  removed_rotation_ids jsonb := '[]'::jsonb;
  deleted_ids jsonb;
  day_index integer;
begin
  if auth.uid() is null or not public.is_claimed_user()
    or public.current_role() is null or public.current_role() not in ('admin', 'lead')
    or not public.current_user_can_manage_department(p_department_id)
  then raise exception 'Not allowed to save department rotations'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'Changes must be an array'; end if;
  if jsonb_array_length(p_changes) = 0 then raise exception 'No rotation changes to save'; end if;
  if (select count(*) <> count(distinct item->>'profileId') from jsonb_array_elements(p_changes) item)
  then raise exception 'Each changed person must appear once'; end if;

  -- Full resets can touch other departments: acquire every department lock first.
  perform 1 from public.departments department
  where department.id = p_department_id or (
    public.current_role() = 'admin' and exists (
      select 1 from jsonb_array_elements(p_changes) item
      where item->>'action' = 'reset' and (
        public.profile_belongs_to_department((item->>'profileId')::uuid, department.id)
        or exists (select 1 from public.department_lead_rotation_versions lead
          where lead.department_id = department.id and lead.pattern ? (item->>'profileId'))
      )
    )
  ) order by department.id for update;
  perform 1 from public.employee_profiles profile
  where profile.id in (select (item->>'profileId')::uuid from jsonb_array_elements(p_changes) item)
  order by profile.id for update;

  -- Review every future boundary before making any changes, under the same locks.
  for entry in select value from jsonb_array_elements(p_changes) loop
    target_id := (entry->>'profileId')::uuid;
    if not public.profile_belongs_to_department(target_id, p_department_id)
      or (public.current_role() = 'lead' and not public.profile_directly_belongs_to_department(target_id, p_department_id))
    then raise exception 'Changed person is outside your department'; end if;
    if entry->>'action' = 'reset' then continue; end if;
    start_date := (entry->>'effectiveStart')::date;
    if start_date is null then raise exception 'Effective start is required'; end if;
    if public.current_role() = 'lead' and start_date < current_date then
      raise exception 'Department Leads cannot change past rotation versions';
    end if;
    future_policy := coalesce(entry->>'futurePolicy', '');
    if future_policy not in ('', 'keep', 'replace') then raise exception 'Unknown later-version choice'; end if;

    select jsonb_build_object(
      'rotations', coalesce((select jsonb_agg(jsonb_build_object('id', row.id, 'effectiveStart', row.effective_start, 'pattern', row.pattern)
        order by row.effective_start, row.id) from public.rotation_versions row
        where row.profile_id = target_id and row.effective_start > start_date
          and row.id::text is distinct from entry->>'sourceVersionId'), '[]'::jsonb),
      'leads', case when coalesce((entry->>'preserveLeads')::boolean, false) then '[]'::jsonb else
        coalesce((select jsonb_agg(jsonb_build_object('id', lead.id, 'effectiveStart', lead.effective_start, 'pattern', lead.pattern)
          order by lead.effective_start, lead.id) from public.department_lead_rotation_versions lead
          where lead.department_id = p_department_id and lead.effective_start > start_date and exists (
            select 1 from jsonb_array_elements_text(lead.pattern) with ordinality slot(value, ordinal)
            where case when coalesce((entry->'leadDays'->>(slot.ordinal::int - 1))::boolean, false)
              then slot.value is distinct from target_id::text else slot.value = target_id::text end
          )), '[]'::jsonb) end
    ) into future_snapshot;
    if (jsonb_array_length(future_snapshot->'rotations') > 0 or jsonb_array_length(future_snapshot->'leads') > 0)
      and future_policy = ''
    then raise exception 'Later versions exist. Review their dates before saving'; end if;
    if (entry ? 'expectedFuture' and entry->'expectedFuture' is distinct from future_snapshot)
      or (future_policy <> '' and not entry ? 'expectedFuture')
    then raise exception 'Later versions changed. Reload and review the dates again'; end if;
  end loop;

  -- Reject ambiguous lead ownership within the same effective date.
  if exists (
    select 1 from jsonb_array_elements(p_changes) item,
      lateral jsonb_array_elements(item->'leadDays') with ordinality slot(value, day)
    where coalesce(item->>'action', 'save') <> 'reset' and coalesce((item->>'preserveLeads')::boolean, false) = false
      and slot.value = 'true'::jsonb
    group by (item->>'effectiveStart')::date, slot.day having count(*) > 1
  ) then raise exception 'Only one person can be Lead on a weekday for the same start date'; end if;

  for entry in select value from jsonb_array_elements(p_changes)
    order by (value->>'effectiveStart')::date nulls first, value->>'profileId'
  loop
    target_id := (entry->>'profileId')::uuid;
    action_name := coalesce(entry->>'action', 'save');
    if action_name not in ('save', 'move', 'reset') then raise exception 'Unknown rotation change'; end if;
    if not public.profile_belongs_to_department(target_id, p_department_id)
      or (public.current_role() = 'lead' and not public.profile_directly_belongs_to_department(target_id, p_department_id))
    then raise exception 'Changed person is outside your department'; end if;

    if action_name = 'reset' then
      perform public.reset_person_rotation(target_id);
      reset_ids := reset_ids || to_jsonb(target_id::text);
      continue;
    end if;
    start_date := (entry->>'effectiveStart')::date;
    if start_date is null then raise exception 'Effective start is required'; end if;
    if entry->>'futurePolicy' = 'replace' then
      with removed as (
        delete from public.rotation_versions where profile_id = target_id and effective_start > start_date
          and id::text is distinct from entry->>'sourceVersionId'
        returning id
      ) select coalesce(jsonb_agg(id), '[]'::jsonb) into deleted_ids from removed;
      removed_rotation_ids := removed_rotation_ids || deleted_ids;
      insert into public.audit_log(actor_id, action, entity_type, entity_id, detail)
      values (auth.uid(), 'rotation.future_replaced', 'profile', target_id::text, entry->'expectedFuture');
    end if;
    if jsonb_typeof(entry->'pattern') is distinct from 'array'
      or jsonb_typeof(entry->'leadDays') is distinct from 'array'
    then raise exception 'Weekday shifts and Lead choices are required'; end if;
    select array_agg(value order by ordinal) into pattern_value
      from jsonb_array_elements_text(entry->'pattern') with ordinality slot(value, ordinal);
    select array_agg(value::boolean order by ordinal) into lead_days
      from jsonb_array_elements_text(entry->'leadDays') with ordinality slot(value, ordinal);

    if action_name = 'move' then
      if public.current_role() is distinct from 'admin' then raise exception 'Only Admin can correct saved version dates'; end if;
      select * into source_row from public.rotation_versions
        where id = (entry->>'sourceVersionId')::uuid and profile_id = target_id for update;
      if not found or source_row.effective_start is distinct from (entry->>'sourceEffectiveStart')::date
        or to_jsonb(source_row.pattern) is distinct from entry->'sourcePattern'
      then raise exception 'This saved version changed. Reload before correcting its date'; end if;
      if exists (select 1 from public.rotation_versions where profile_id = target_id
        and effective_start = start_date and id <> source_row.id)
      then raise exception 'A rotation already exists on that date. Choose another date or edit that version'; end if;

      select pattern into previous_leads from public.department_lead_rotation_versions
        where department_id = p_department_id and effective_start < source_row.effective_start
        order by effective_start desc limit 1;
      previous_leads := coalesce(previous_leads, '["","","","","","",""]'::jsonb);
      update public.department_lead_rotation_versions lead set pattern = (
        select jsonb_agg(case when slot.value = target_id::text then coalesce(previous_leads->>(slot.ordinal::int - 1), '')
          else coalesce(slot.value, '') end order by slot.ordinal)
        from jsonb_array_elements_text(lead.pattern) with ordinality slot(value, ordinal)
      ) where lead.department_id = p_department_id and lead.effective_start = source_row.effective_start
        and start_date > source_row.effective_start;
      -- Remove a now-redundant boundary so a later correction cannot leave a stale Lead cutoff.
      delete from public.department_lead_rotation_versions lead
        where lead.department_id = p_department_id and lead.effective_start = source_row.effective_start
          and start_date > source_row.effective_start and lead.pattern = previous_leads;
      update public.rotation_versions set effective_start = start_date where id = source_row.id;
      insert into public.audit_log(actor_id, action, entity_type, entity_id, detail)
      values (auth.uid(), 'rotation.date_corrected', 'rotation_version', source_row.id::text,
        jsonb_build_object('from', source_row.effective_start, 'to', start_date));
    end if;

    if coalesce((entry->>'preserveLeads')::boolean, false) and action_name = 'save' then
      select jsonb_build_object('rotation', to_jsonb(row)) into saved from public.apply_rotation_patterns(
        p_department_id, start_date, jsonb_build_array(jsonb_build_object('profileId', target_id, 'pattern', pattern_value))
      ) row;
    else
      saved := public.save_person_rotation(p_department_id, target_id, start_date, pattern_value, lead_days);
    end if;
    saved_rows := saved_rows || jsonb_build_array(saved->'rotation');
    insert into public.audit_log(actor_id, action, entity_type, entity_id, detail)
    values (auth.uid(), 'rotation.saved', 'rotation_version', saved->'rotation'->>'id',
      jsonb_build_object('effective_start', start_date, 'department_id', p_department_id));
  end loop;
  -- Explicit Apply onward merges only the edited person's Lead choices into later department patterns.
  for entry in select value from jsonb_array_elements(p_changes)
    where value->>'futurePolicy' = 'replace' and coalesce(value->>'action', 'save') <> 'reset'
      and not coalesce((value->>'preserveLeads')::boolean, false)
    order by (value->>'effectiveStart')::date, value->>'profileId'
  loop
    target_id := (entry->>'profileId')::uuid;
    start_date := (entry->>'effectiveStart')::date;
    for day_index in 0..6 loop
      update public.department_lead_rotation_versions lead
      set pattern = jsonb_set(lead.pattern, array[day_index::text],
        case when (entry->'leadDays'->>day_index)::boolean then to_jsonb(target_id::text)
          when lead.pattern->>day_index = target_id::text then '""'::jsonb
          else lead.pattern->day_index end)
      where lead.department_id = p_department_id and lead.effective_start >= start_date;
    end loop;
  end loop;
  return jsonb_build_object('rotations', saved_rows, 'reset_profile_ids', reset_ids,
    'removed_rotation_ids', removed_rotation_ids,
    'lead_rotations', coalesce((select jsonb_agg(to_jsonb(lead)) from public.department_lead_rotation_versions lead
      where lead.department_id = p_department_id), '[]'::jsonb));
end;
$$;

revoke all on function public.save_rotation_drafts(uuid, jsonb) from public, anon;
grant execute on function public.save_rotation_drafts(uuid, jsonb) to authenticated;

-- New clients use a new entry point so a pre-migration server cannot ignore review choices.
create or replace function public.save_reviewed_rotation_drafts(p_department_id uuid, p_changes jsonb)
returns jsonb language sql security invoker set search_path = public
as $$ select public.save_rotation_drafts(p_department_id, p_changes); $$;
revoke all on function public.save_reviewed_rotation_drafts(uuid, jsonb) from public, anon;
grant execute on function public.save_reviewed_rotation_drafts(uuid, jsonb) to authenticated;
select pg_notify('pgrst', 'reload schema');
