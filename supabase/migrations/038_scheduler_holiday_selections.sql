begin;

alter table public.public_holidays
  add column batch_id uuid,
  add column selected_profiles uuid[],
  add constraint holiday_selection_requires_batch check (
    (batch_id is null and selected_profiles is null) or
    (batch_id is not null and selected_profiles is not null and cardinality(selected_profiles) > 0 and day_off)
  );
alter table public.public_holidays drop constraint public_holidays_holiday_date_key;
create unique index public_holidays_legacy_date on public.public_holidays(holiday_date) where batch_id is null;
create unique index public_holidays_batch_date on public.public_holidays(batch_id, holiday_date) where batch_id is not null;
create index public_holidays_date on public.public_holidays(holiday_date);

create function public.holiday_applies(p_holiday public.public_holidays, p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_holiday.batch_id is not null then p_profile = any(p_holiday.selected_profiles)
    else public.holiday_covers_profile(p_profile, p_holiday.department_ids) end
$$;
revoke all on function public.holiday_applies(public.public_holidays,uuid) from public, anon, authenticated;

create function public.save_scheduler_holiday(p_batch uuid, p_name text, p_cells jsonb, p_delete boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  batch uuid := coalesce(p_batch, gen_random_uuid());
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
revoke all on function public.save_scheduler_holiday(uuid,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.save_scheduler_holiday(uuid,text,jsonb,boolean) to authenticated;

create or replace function public.annual_eligible_dates(p_profile_id uuid, p_start date, p_end date)
returns table(shift_date date) language sql stable security definer set search_path = public as $$
  select d.day::date
  from generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') d(day)
  left join public.schedule_overrides o on o.profile_id = p_profile_id and o.shift_date = d.day::date
  join public.shift_statuses s on s.id = coalesce(o.status_id, public.rotation_status_on(p_profile_id, d.day::date))
  where s.kind = 'working' and s.id not in ('weekend', 'sick', 'vacation', 'low_day')
    and not exists (select 1 from public.low_day_credits c where c.profile_id = p_profile_id and c.worked_date = d.day::date)
    and not exists (
      select 1 from public.public_holidays h
      where h.holiday_date = d.day::date and h.day_off and (h.batch_id is not null or o.id is null)
        and public.holiday_applies(h, p_profile_id)
    )
$$;

create or replace function public.calendar_holiday_rows(p_profiles uuid[], p_year integer default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'batchId', h.batch_id, 'date', h.holiday_date, 'name', h.name, 'dayOff', h.day_off,
    'organizationWide', h.batch_id is null and cardinality(h.department_ids) = 0,
    'departmentIds', case when p_year is null then array(select id from unnest(h.department_ids) team(id)
      where public.current_user_can_access_department(id)) else '{}'::uuid[] end,
    'profileIds', affected.ids
  ) order by h.holiday_date, h.id), '[]'::jsonb)
  from public.public_holidays h
  cross join lateral (
    select array(select profile.id from unnest(p_profiles) profile(id)
      where public.holiday_applies(h, profile.id) and (
        p_year is null or h.batch_id is null or not exists (
          select 1 from public.low_day_credits c where c.profile_id = profile.id and c.worked_date = h.holiday_date
        )
      )) as ids
  ) affected
  where (p_year is null or h.holiday_date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31))
    and (cardinality(affected.ids) > 0 or (p_year is null and (
      public.current_role() = 'admin' or (h.batch_id is null and (
        cardinality(h.department_ids) = 0 or exists (select 1 from unnest(h.department_ids) team(id)
          where public.current_user_can_access_department(id)))))))
$$;

create function public.refund_worked_annual(p_profile uuid, p_date date, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  request public.vacation_requests;
  balance public.annual_balance_years;
  yr integer := extract(year from p_date);
  charge integer;
  legacy boolean;
  prior_action text := current_setting('sport360.annual_action', true);
begin
  select * into request from public.vacation_requests r
    where r.profile_id = p_profile and r.status = 'approved' and p_date between r.start_date and r.end_date
      and p_note = 'Vacation request ' || r.id::text for update;
  if not found or request.deducted_days = 0 then return null; end if;
  legacy := request.deducted_days_by_year = '{}'::jsonb;
  charge := coalesce((request.deducted_days_by_year->>yr::text)::integer, 0);
  if not legacy and charge = 0 then return null; end if;

  update public.annual_balance_years set remaining_days = remaining_days + 1, updated_at = now()
    where profile_id = p_profile and balance_year = yr returning * into balance;
  if not found then
    raise exception 'The Annual balance for % is unavailable. Review it before overriding this leave.', yr;
  end if;
  perform set_config('sport360.annual_action', 'approval', true);
  update public.employee_profiles set remaining_vacation_days = balance.remaining_days, updated_at = now()
    where id = p_profile and annual_balance_year = yr;
  perform set_config('sport360.annual_action', coalesce(prior_action, ''), true);

  update public.vacation_requests set deducted_days = deducted_days - 1,
    deducted_days_by_year = case when legacy then deducted_days_by_year
      else jsonb_set(deducted_days_by_year, array[yr::text], to_jsonb(charge - 1)) end
    where id = request.id returning * into request;
  return jsonb_build_object('request', to_jsonb(request), 'balance', to_jsonb(balance));
end;
$$;
revoke all on function public.refund_worked_annual(uuid,date,text) from public, anon, authenticated;


create or replace function public.save_public_holiday(
  p_id uuid, p_date date, p_name text, p_department_ids uuid[], p_day_off boolean, p_delete boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prior public.public_holidays;
  saved public.public_holidays;
  teams uuid[] := coalesce(p_department_ids, '{}');
begin
  if auth.uid() is null or public.is_claimed_user() is not true or public.current_role() is distinct from 'admin' then
    raise exception 'Only Admin can manage public holidays.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(360036);
  select * into prior from public.public_holidays where id = p_id and batch_id is null;
  if p_id is not null and not found then raise exception 'This holiday is no longer available.'; end if;

  if not p_delete then
    if p_date is null or p_day_off is null or coalesce(length(trim(p_name)), 0) not between 1 and 100 then
      raise exception 'Enter a holiday name, observed date, and schedule treatment.';
    end if;
    if exists (select 1 from unnest(teams) team(id) where id is null or not public.team_is_assignable(id)) then
      raise exception 'Choose valid leaf teams.';
    end if;
    if exists (select 1 from public.public_holidays where holiday_date = p_date and id is distinct from p_id) then
      raise exception 'There is already a public holiday on this date. Edit that entry.';
    end if;
    if exists (select 1 from public.low_day_credits c
      where c.replacement_date = p_date and p_date >= (now() at time zone 'Africa/Cairo')::date
        and public.holiday_covers_profile(c.profile_id, teams)) then
      raise exception 'A replacement day is booked for this date. Reschedule it before saving the holiday.';
    end if;
  elsif p_id is null then
    raise exception 'Choose a holiday to remove.';
  end if;

  -- Annual approvals lock the same profile rows before resolving eligible days.
  perform 1 from public.employee_profiles p
    where (prior.id is not null and public.holiday_covers_profile(p.id, prior.department_ids))
       or (not p_delete and public.holiday_covers_profile(p.id, teams))
    order by p.id for update;

  if p_delete then
    delete from public.public_holidays where id = p_id;
    saved := prior;
  elsif p_id is null then
    insert into public.public_holidays (holiday_date, name, department_ids, day_off)
    values (p_date, trim(p_name), teams, p_day_off) returning * into saved;
  else
    update public.public_holidays set holiday_date = p_date, name = trim(p_name),
      department_ids = teams, day_off = p_day_off, updated_at = now()
    where id = p_id returning * into saved;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), case when p_delete then 'holiday.deleted' else 'holiday.saved' end,
    'public_holiday', saved.id::text, to_jsonb(saved));
  return public.get_low_day_calendar();
end;
$$;

create or replace function public.confirm_low_day_work(p_profile uuid, p_date date, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Africa/Cairo')::date;
  holiday boolean;
  refund jsonb;
  prior public.schedule_overrides;
  saved public.schedule_overrides;
  credit public.low_day_credits;
begin
  if auth.uid() is null or public.is_claimed_user() is not true
    or public.current_user_can_manage_profile(p_profile) is not true then
    raise exception 'You can only confirm work for people on your teams.' using errcode = '42501';
  end if;
  if p_date is null or p_date > today or p_status is null
    or p_status not in ('morning', 'midday', 'night', 'ground')
    or not exists (select 1 from public.shift_statuses where id = p_status and kind = 'working') then
    raise exception 'Choose a working shift on a date that has already started.';
  end if;
  perform pg_advisory_xact_lock(360036);
  perform public.lock_profile_structure(p_profile);
  if not exists (select 1 from public.employee_profiles where id = p_profile)
    or public.current_user_can_manage_profile(p_profile) is not true then
    raise exception 'Profile access denied.' using errcode = '42501';
  end if;
  if exists (select 1 from public.low_day_credits where profile_id = p_profile and worked_date = p_date) then
    raise exception 'A Low Days credit already exists for this person and date.';
  end if;

  select exists (select 1 from public.public_holidays h where h.holiday_date = p_date
    and public.holiday_applies(h, p_profile)) into holiday;
  select * into prior from public.schedule_overrides where profile_id = p_profile and shift_date = p_date for update;
  if prior.status_id = 'low_day' then
    raise exception 'This date is a booked replacement day. Manage it in Team Alerts.';
  end if;
  if not holiday and coalesce(prior.status_id, '') not in ('weekend', 'vacation', 'sick')
    and public.rotation_status_on(p_profile, p_date) is distinct from 'weekend' then
    raise exception 'Choose a scheduled day off, public holiday, or leave day.';
  end if;

  if prior.status_id = 'vacation' then
    refund := public.refund_worked_annual(p_profile, p_date, prior.note);
  end if;
  if prior.id is null then
    insert into public.schedule_overrides (profile_id, shift_date, status_id, note, created_by)
    values (p_profile, p_date, p_status, nullif(trim(p_note), ''), auth.uid()) returning * into saved;
  else
    update public.schedule_overrides set status_id = p_status,
      note = coalesce(nullif(trim(p_note), ''), case when prior.status_id not in ('weekend', 'vacation', 'sick') then prior.note end),
      updated_at = now() where id = prior.id returning * into saved;
  end if;
  insert into public.low_day_credits (profile_id, worked_date, worked_status_id, reason, confirmed_by)
  values (p_profile, p_date, p_status, case when holiday then 'public_holiday' else 'day_off' end, auth.uid())
  returning * into credit;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'low_day.earned', 'profile', p_profile::text,
    jsonb_build_object('credit_id', credit.id, 'worked_date', p_date, 'due_date', credit.due_date, 'reason', credit.reason,
      'previous_status', prior.status_id, 'annual_refund', refund is not null));
  return jsonb_build_object('credit', to_jsonb(credit) - 'prior_override', 'override', to_jsonb(saved), 'refund', refund);
end;
$$;

create or replace function public.book_low_day(p_credit uuid, p_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Africa/Cairo')::date;
  credit public.low_day_credits;
  prior_date date;
  previous public.schedule_overrides;
  restored public.schedule_overrides;
  saved public.schedule_overrides;
  previous_snapshot jsonb;
  scheduled_status text;
begin
  if auth.uid() is null or public.is_claimed_user() is not true then
    raise exception 'Profile access required.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(360036);
  select * into credit from public.low_day_credits where id = p_credit;
  if not found or public.current_user_can_manage_profile(credit.profile_id) is not true then
    raise exception 'You can only book replacement days for people on your teams.' using errcode = '42501';
  end if;
  perform public.lock_profile_structure(credit.profile_id);
  select * into credit from public.low_day_credits where id = p_credit for update;
  if not found or public.current_user_can_manage_profile(credit.profile_id) is not true then
    raise exception 'Profile access denied.' using errcode = '42501';
  end if;
  prior_date := credit.replacement_date;
  if prior_date < today then raise exception 'This replacement day has already been taken.'; end if;
  if p_date is null and prior_date is null then raise exception 'This credit has no booking.'; end if;
  if p_date is not null and (p_date < today or p_date <= credit.worked_date or p_date > credit.due_date) then
    raise exception 'Choose an upcoming working day after the worked date and by %.', credit.due_date;
  end if;
  if p_date is not null and p_date = prior_date then
    select * into saved from public.schedule_overrides where profile_id = credit.profile_id and shift_date = p_date;
    return jsonb_build_object('credit', to_jsonb(credit) - 'prior_override', 'override', to_jsonb(saved));
  end if;

  if prior_date is not null then
    if credit.prior_override is null then
      delete from public.schedule_overrides where profile_id = credit.profile_id and shift_date = prior_date and status_id = 'low_day';
    else
      update public.schedule_overrides set status_id = credit.prior_override->>'status_id',
        note = credit.prior_override->>'note', updated_at = now()
      where profile_id = credit.profile_id and shift_date = prior_date and status_id = 'low_day'
      returning * into restored;
    end if;
    if not found then raise exception 'The existing booking changed. Reload and review it.'; end if;
  end if;

  if p_date is not null then
    if exists (select 1 from public.public_holidays h where h.holiday_date = p_date
      and public.holiday_applies(h, credit.profile_id)) then
      raise exception 'Choose a regular working day outside public holidays.';
    end if;
    select * into previous from public.schedule_overrides
      where profile_id = credit.profile_id and shift_date = p_date for update;
    scheduled_status := coalesce(previous.status_id, public.rotation_status_on(credit.profile_id, p_date), '');
    if scheduled_status not in ('morning', 'midday', 'night')
      or not exists (select 1 from public.shift_statuses where id = scheduled_status and kind = 'working')
      or exists (
         select 1 from public.low_day_credits c where c.profile_id = credit.profile_id and c.worked_date = p_date
       ) then
      raise exception 'Choose a scheduled working day without leave, field work, or another Low Days entry.';
    end if;

    if previous.id is null then
      insert into public.schedule_overrides (profile_id, shift_date, status_id, note, created_by)
      values (credit.profile_id, p_date, 'low_day', 'Worked ' || credit.worked_date, auth.uid()) returning * into saved;
    else
      previous_snapshot := to_jsonb(previous);
      update public.schedule_overrides set status_id = 'low_day', note = 'Worked ' || credit.worked_date, updated_at = now()
      where id = previous.id returning * into saved;
    end if;
  end if;
  update public.low_day_credits set replacement_date = p_date, prior_override = previous_snapshot
    where id = p_credit returning * into credit;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), case when p_date is null then 'low_day.booking_cancelled' else 'low_day.booked' end,
    'profile', credit.profile_id::text, jsonb_build_object('credit_id', p_credit, 'previous_date', prior_date, 'replacement_date', p_date));
  return jsonb_build_object('credit', to_jsonb(credit) - 'prior_override', 'override', to_jsonb(saved),
    'previousDate', prior_date, 'restoredOverride', to_jsonb(restored));
end;
$$;

create or replace function public.get_low_day_calendar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_claimed_user() is not true then
    raise exception 'Profile access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'holidaySelectionEnabled', true,
    'holidays', public.calendar_holiday_rows(array(
      select p.id from public.employee_profiles p where public.current_user_can_read_profile(p.id)
    )),
    'credits', coalesce((
      select jsonb_agg(to_jsonb(c) - 'prior_override' order by c.due_date, c.id)
      from public.low_day_credits c
      where c.profile_id = public.current_profile_id() or public.current_user_can_manage_profile(c.profile_id)
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
