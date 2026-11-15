begin;

create or replace function public.save_scheduler_holiday_base(p_batch uuid, p_name text, p_cells jsonb, p_delete boolean, p_new_batch uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  batch uuid := coalesce(p_batch, p_new_batch, gen_random_uuid());
begin
  if auth.uid() is null or public.is_claimed_user() is not true or public.current_role() is distinct from 'admin' then
    raise exception 'Only Admin can manage public holidays.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(360036);
  if p_batch is not null and not exists (select 1 from public.public_holidays where batch_id = p_batch) then
    raise exception 'This holiday is no longer available.';
  end if;
  if p_delete is true then
    if p_batch is null then raise exception 'Choose a holiday to remove.'; end if;
  else
    if coalesce(length(trim(p_name)), 0) not between 1 and 100
      or jsonb_typeof(p_cells) is distinct from 'array' then
      raise exception 'Enter a holiday name and select dates or shifts.';
    end if;
    if jsonb_array_length(p_cells) not between 1 and 10000 then
      raise exception 'Select between 1 and 10,000 person-days per holiday.';
    end if;
    if exists (
      select 1 from jsonb_to_recordset(p_cells) cell(profile_id uuid, day date)
      left join public.employee_profiles p on p.id = cell.profile_id
      where p.id is null or cell.day is null or not isfinite(cell.day)
    ) then raise exception 'A selected person or date is no longer valid.'; end if;
  end if;

  -- Serialize with Annual approvals and other mutations affecting these people.
  perform 1 from public.employee_profiles p where p.id in (
    select unnest(selected_profiles) from public.public_holidays where batch_id = batch
    union
    select profile_id from jsonb_to_recordset(case when p_delete is true then '[]'::jsonb else p_cells end)
      cell(profile_id uuid, day date)
  ) order by p.id for update;

  if p_delete is not true then
    -- Existing allocations stay editable even if they now overlap time off.
    if exists (
      select 1 from jsonb_to_recordset(p_cells) cell(profile_id uuid, day date)
      left join public.schedule_overrides o on o.profile_id = cell.profile_id and o.shift_date = cell.day
      where coalesce(o.status_id, public.rotation_status_on(cell.profile_id, cell.day)) in ('weekend', 'vacation', 'sick')
        and not exists (
          select 1 from public.public_holidays saved where saved.batch_id = p_batch
            and saved.holiday_date = cell.day and cell.profile_id = any(saved.selected_profiles)
        )
    ) then raise exception 'A selected shift is Weekend, Annual, or Sick. Review the updated schedule.'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_cells) cell(profile_id uuid, day date)
      join public.public_holidays h on h.holiday_date = cell.day and h.day_off
      where h.batch_id is distinct from batch and public.holiday_applies(h, cell.profile_id)
    ) then raise exception 'A selected shift already has a public holiday. Review the existing holiday first.'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_cells) cell(profile_id uuid, day date)
      join public.low_day_credits c on c.profile_id = cell.profile_id and c.replacement_date = cell.day
      where cell.day >= (now() at time zone 'Africa/Cairo')::date
    ) then raise exception 'A replacement day is booked on a selected shift. Reschedule it first.'; end if;
  end if;

  delete from public.public_holidays where batch_id = batch;
  if p_delete is not true then
    insert into public.public_holidays (batch_id, holiday_date, name, day_off, selected_profiles)
    select batch, day, trim(p_name), true, array_agg(distinct profile_id order by profile_id)
    from jsonb_to_recordset(p_cells) cell(profile_id uuid, day date) group by day;
  end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), case when p_delete then 'holiday.deleted' else 'holiday.saved' end,
    'public_holiday', batch::text, jsonb_build_object('name', trim(p_name), 'cells', p_cells));
  return public.get_low_day_calendar();
end;
$$;
revoke all on function public.save_scheduler_holiday_base(uuid,text,jsonb,boolean,uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
