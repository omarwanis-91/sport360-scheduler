begin;

create table public.low_day_settings (
  singleton boolean primary key default true check (singleton),
  expiry_days integer not null check (expiry_days between 1 and 365)
);
insert into public.low_day_settings (expiry_days) values (30);

create table public.holiday_entitlements (
  batch_id uuid primary key,
  days integer not null check (days between 1 and 365),
  profile_ids uuid[] not null,
  expiry_days integer not null check (expiry_days between 1 and 365)
);
alter table public.low_day_settings enable row level security;
alter table public.holiday_entitlements enable row level security;
revoke all on public.low_day_settings, public.holiday_entitlements from public, anon, authenticated;

alter table public.low_day_credits
  drop constraint low_day_credits_profile_id_worked_date_key,
  drop constraint low_day_credits_reason_check,
  drop constraint low_day_credits_check,
  drop column due_date,
  add column expiry_days integer not null default 30 check (expiry_days between 1 and 365),
  add column holiday_batch_id uuid,
  add column holiday_name text,
  add column holiday_credit_number integer,
  add column worked_override_before jsonb,
  add column worked_override_id uuid,
  add column annual_request_id uuid,
  alter column worked_status_id drop not null;
alter table public.low_day_credits
  add column due_date date generated always as (worked_date + expiry_days) stored,
  add constraint low_day_replacement_window check (replacement_date > worked_date and replacement_date <= worked_date + expiry_days),
  add constraint low_day_credit_source check (
    (reason in ('day_off', 'public_holiday') and worked_status_id is not null and holiday_batch_id is null
      and holiday_credit_number is null)
    or (reason = 'holiday_shortfall' and worked_status_id is null and holiday_batch_id is not null
      and holiday_name is not null and holiday_credit_number is not null and holiday_credit_number between 1 and 365)
  );
create unique index low_day_one_credit_per_worked_shift on public.low_day_credits (profile_id, worked_date)
  where holiday_batch_id is null;
create unique index low_day_one_credit_per_holiday_day_owed on public.low_day_credits (holiday_batch_id, profile_id, holiday_credit_number)
  where holiday_batch_id is not null;

create function public.save_low_day_expiry(p_days integer)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_claimed_user() is not true or public.current_role() is distinct from 'admin' then
    raise exception 'Only Admin can change the Low Days expiry.' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'Enter a Low Days expiry between 1 and 365 calendar days.';
  end if;
  perform pg_advisory_xact_lock(360036);
  update public.low_day_settings set expiry_days = p_days;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'low_day.expiry_changed', 'system', 'low_day_expiry', jsonb_build_object('expiry_days', p_days));
  return p_days;
end;
$$;

-- Reuse the holiday allocation validation and keep old clients on the same transaction.
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

create function public.save_entitled_scheduler_holiday(
  p_batch uuid, p_name text, p_cells jsonb, p_delete boolean, p_days integer, p_profile_ids uuid[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  batch uuid;
  reference_date date;
  entitlement public.holiday_entitlements;
begin
  if auth.uid() is null or public.is_claimed_user() is not true or public.current_role() is distinct from 'admin' then
    raise exception 'Only Admin can manage public holidays.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(360036);
  select * into entitlement from public.holiday_entitlements where batch_id = p_batch;

  if p_delete is true then
    if exists (select 1 from public.low_day_credits where holiday_batch_id = p_batch and replacement_date is not null) then
      raise exception 'This holiday has booked replacement days. Cancel upcoming bookings before removing it.';
    end if;
    perform public.save_scheduler_holiday_base(p_batch, p_name, p_cells, true, null);
    delete from public.low_day_credits where holiday_batch_id = p_batch;
    delete from public.holiday_entitlements where batch_id = p_batch;
    return public.get_low_day_calendar();
  end if;

  if p_days is null and entitlement.batch_id is not null then
    p_days := entitlement.days;
    p_profile_ids := array(select p.id from public.employee_profiles p where p.id = any(entitlement.profile_ids));
  end if;
  if p_days is not null and (p_days not between 1 and 365 or p_profile_ids is null
    or cardinality(p_profile_ids) not between 1 and 10000
    or array_position(p_profile_ids, null) is not null) then
    raise exception 'Choose 1 to 365 holiday days and include the people entitled to them.';
  end if;
  if p_days is not null and exists (
    select 1 from unnest(p_profile_ids) roster(id)
    left join public.employee_profiles p on p.id = roster.id where p.id is null
  ) then raise exception 'One of the people in the holiday review is no longer available.'; end if;

  batch := coalesce(p_batch, gen_random_uuid());
  perform public.save_scheduler_holiday_base(p_batch, p_name, p_cells, false, batch);
  if p_days is null then return public.get_low_day_calendar(); end if;

  select max(holiday_date) into reference_date from public.public_holidays where batch_id = batch;
  insert into public.holiday_entitlements (batch_id, days, profile_ids, expiry_days)
  select batch, p_days, array(
    select id from unnest(p_profile_ids) roster(id)
    union
    select unnest(h.selected_profiles) from public.public_holidays h where h.batch_id = batch
    order by id
  ),
    (select expiry_days from public.low_day_settings)
  on conflict (batch_id) do update set days = excluded.days, profile_ids = excluded.profile_ids
  returning * into entitlement;

  if exists (
    select 1 from public.low_day_credits c where c.holiday_batch_id = batch and c.replacement_date is not null
    and (c.replacement_date <= reference_date or c.replacement_date > reference_date + entitlement.expiry_days)
  ) then raise exception 'The holiday dates conflict with a booked replacement day.'; end if;

  -- Keep existing credit IDs when the entitlement is edited. Issue one credit per unallocated day.
  with counts as (
    select roster.id, greatest(0, p_days - count(h.id)::int) as owed
    from unnest(entitlement.profile_ids) roster(id)
    left join public.public_holidays h on h.batch_id = batch and roster.id = any(h.selected_profiles)
    group by roster.id
  )
  insert into public.low_day_credits (
    profile_id, worked_date, reason, confirmed_by, expiry_days, holiday_batch_id, holiday_name, holiday_credit_number
  )
  select id, reference_date, 'holiday_shortfall', auth.uid(), entitlement.expiry_days, batch, trim(p_name), number
  from counts cross join lateral generate_series(1, owed) number
  on conflict (holiday_batch_id, profile_id, holiday_credit_number) where holiday_batch_id is not null
  do update set worked_date = excluded.worked_date, holiday_name = excluded.holiday_name;

  if exists (
    select 1 from public.low_day_credits c where c.holiday_batch_id = batch and c.replacement_date is not null
      and (not c.profile_id = any(entitlement.profile_ids) or c.holiday_credit_number > p_days - (
        select count(*) from public.public_holidays h where h.batch_id = batch and c.profile_id = any(h.selected_profiles)
      ))
  ) then raise exception 'This change would remove a booked replacement day. Cancel the booking first.'; end if;
  delete from public.low_day_credits c where c.holiday_batch_id = batch
    and (not c.profile_id = any(entitlement.profile_ids) or c.holiday_credit_number > p_days - (
      select count(*) from public.public_holidays h where h.batch_id = batch and c.profile_id = any(h.selected_profiles)
    ));
  return public.get_low_day_calendar();
end;
$$;

create or replace function public.save_scheduler_holiday(p_batch uuid,p_name text,p_cells jsonb,p_delete boolean default false)
returns jsonb language sql security definer set search_path = public as $$
  select public.save_entitled_scheduler_holiday(p_batch,p_name,p_cells,p_delete,null,null)
$$;
revoke all on function public.save_scheduler_holiday(uuid,text,jsonb,boolean),
  public.save_entitled_scheduler_holiday(uuid,text,jsonb,boolean,integer,uuid[]), public.save_low_day_expiry(integer)
  from public, anon, authenticated;
grant execute on function public.save_scheduler_holiday(uuid,text,jsonb,boolean),
  public.save_entitled_scheduler_holiday(uuid,text,jsonb,boolean,integer,uuid[]), public.save_low_day_expiry(integer)
  to authenticated;


create or replace function public.annual_eligible_dates(p_profile_id uuid, p_start date, p_end date)
returns table(shift_date date) language sql stable security definer set search_path = public as $$
  select d.day::date
  from generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') d(day)
  left join public.schedule_overrides o on o.profile_id = p_profile_id and o.shift_date = d.day::date
  join public.shift_statuses s on s.id = coalesce(o.status_id, public.rotation_status_on(p_profile_id, d.day::date))
  where s.kind = 'working' and s.id not in ('weekend', 'sick', 'vacation', 'low_day')
    and not exists (select 1 from public.low_day_credits c where c.profile_id = p_profile_id and c.worked_date = d.day::date and c.holiday_batch_id is null)
    and not exists (
      select 1 from public.public_holidays h
      where h.holiday_date = d.day::date and h.day_off and (o.id is null or (h.batch_id is not null and o.holiday_override_batch_id is distinct from h.batch_id))
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
        p_year is null or h.batch_id is null or (
          not exists (select 1 from public.low_day_credits c
            where c.profile_id = profile.id and c.worked_date = h.holiday_date and c.holiday_batch_id is null)
          and not exists (select 1 from public.schedule_overrides o
            where o.profile_id = profile.id and o.shift_date = h.holiday_date and o.holiday_override_batch_id = h.batch_id)
        )
      )) as ids
  ) affected
  where (p_year is null or h.holiday_date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31))
    and (cardinality(affected.ids) > 0 or (p_year is null and (
      public.current_role() = 'admin' or (h.batch_id is null and (
        cardinality(h.department_ids) = 0 or exists (select 1 from unnest(h.department_ids) team(id)
          where public.current_user_can_access_department(id)))))))
$$;

create or replace function public.get_low_day_calendar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_claimed_user() is not true then
    raise exception 'Profile access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'holidaySelectionEnabled', true,
    'holidayShiftOverridesEnabled', true,
    'holidayEntitlementsEnabled', true,
    'lowDayExpiryDays', (select expiry_days from public.low_day_settings),
    'holidayEntitlements', case when public.current_role() = 'admin' then coalesce((
      select jsonb_agg(jsonb_build_object('batchId', e.batch_id, 'days', e.days, 'profileIds',
        array(select p.id from public.employee_profiles p where p.id = any(e.profile_ids)), 'expiryDays', e.expiry_days))
      from public.holiday_entitlements e
    ), '[]'::jsonb) else '[]'::jsonb end,
    'holidays', public.calendar_holiday_rows(array(
      select p.id from public.employee_profiles p where public.current_user_can_read_profile(p.id)
    )),
    'credits', coalesce((
      select jsonb_agg(to_jsonb(c) - array['prior_override','worked_override_before','annual_request_id','worked_override_id'] order by c.due_date, c.id)
      from public.low_day_credits c
      where c.profile_id = public.current_profile_id() or public.current_user_can_manage_profile(c.profile_id)
    ), '[]'::jsonb)
  );
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
  if exists (select 1 from public.low_day_credits where profile_id = p_profile and worked_date = p_date and holiday_batch_id is null) then
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
  insert into public.low_day_credits (profile_id, worked_date, worked_status_id, reason, confirmed_by, expiry_days,
    worked_override_before, worked_override_id, annual_request_id)
  values (p_profile, p_date, p_status, case when holiday then 'public_holiday' else 'day_off' end, auth.uid(),
    (select expiry_days from public.low_day_settings), case when prior.id is not null then to_jsonb(prior) end,
    saved.id, (refund->'request'->>'id')::uuid)
  returning * into credit;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'low_day.earned', 'profile', p_profile::text,
    jsonb_build_object('credit_id', credit.id, 'worked_date', p_date, 'due_date', credit.due_date, 'reason', credit.reason,
      'previous_status', prior.status_id, 'annual_refund', refund is not null));
  return jsonb_build_object('credit', to_jsonb(credit) - array['prior_override','worked_override_before','annual_request_id','worked_override_id'], 'override', to_jsonb(saved), 'refund', refund);
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
  booking_note text;
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
  booking_note := case when credit.holiday_batch_id is null then 'Worked ' || credit.worked_date
    else 'Holiday credit: ' || credit.holiday_name end;
  prior_date := credit.replacement_date;
  if prior_date < today then raise exception 'This replacement day has already been taken.'; end if;
  if p_date is null and prior_date is null then raise exception 'This credit has no booking.'; end if;
  if p_date is not null and (p_date < today or p_date <= credit.worked_date or p_date > credit.due_date) then
    raise exception 'Choose an upcoming working day after the worked date and by %.', credit.due_date;
  end if;
  if p_date is not null and p_date = prior_date then
    select * into saved from public.schedule_overrides where profile_id = credit.profile_id and shift_date = p_date;
    return jsonb_build_object('credit', to_jsonb(credit) - array['prior_override','worked_override_before','annual_request_id','worked_override_id'], 'override', to_jsonb(saved));
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
         select 1 from public.low_day_credits c where c.profile_id = credit.profile_id and c.worked_date = p_date and c.holiday_batch_id is null
       ) then
      raise exception 'Choose a scheduled working day without leave, field work, or another Low Days entry.';
    end if;

    if previous.id is null then
      insert into public.schedule_overrides (profile_id, shift_date, status_id, note, created_by)
      values (credit.profile_id, p_date, 'low_day', booking_note, auth.uid()) returning * into saved;
    else
      previous_snapshot := to_jsonb(previous);
      update public.schedule_overrides set status_id = 'low_day', note = booking_note, updated_at = now()
      where id = previous.id returning * into saved;
    end if;
  end if;
  update public.low_day_credits set replacement_date = p_date, prior_override = previous_snapshot
    where id = p_credit returning * into credit;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), case when p_date is null then 'low_day.booking_cancelled' else 'low_day.booked' end,
    'profile', credit.profile_id::text, jsonb_build_object('credit_id', p_credit, 'previous_date', prior_date, 'replacement_date', p_date));
  return jsonb_build_object('credit', to_jsonb(credit) - array['prior_override','worked_override_before','annual_request_id','worked_override_id'], 'override', to_jsonb(saved),
    'previousDate', prior_date, 'restoredOverride', to_jsonb(restored));
end;
$$;
create function public.clear_low_day_work(p_profile uuid, p_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  credit public.low_day_credits;
  current_shift public.schedule_overrides;
  restored public.schedule_overrides;
  request public.vacation_requests;
  balance public.annual_balance_years;
  snapshot jsonb;
  audit_detail jsonb;
  linked_request uuid;
  matching_requests uuid[];
  yr integer := extract(year from p_date);
  prior_action text := current_setting('sport360.annual_action', true);
  returned_balance jsonb;
begin
  if auth.uid() is null or public.is_claimed_user() is not true
    or public.current_user_can_manage_profile(p_profile) is not true
    or (public.current_role() <> 'admin' and p_date < (now() at time zone 'Africa/Cairo')::date) then
    raise exception 'You cannot clear this worked shift.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(360036);
  perform public.lock_profile_structure(p_profile);
  if public.current_user_can_manage_profile(p_profile) is not true then
    raise exception 'You cannot clear this worked shift.' using errcode = '42501';
  end if;
  select * into credit from public.low_day_credits
    where profile_id = p_profile and worked_date = p_date and holiday_batch_id is null for update;
  if not found then raise exception 'This worked-day credit is no longer available.'; end if;
  if credit.replacement_date is not null then
    if credit.replacement_date < (now() at time zone 'Africa/Cairo')::date then
      raise exception 'The replacement day has already been taken.';
    end if;
    raise exception 'Cancel the booked replacement in Team Alerts before clearing this shift.';
  end if;
  select * into current_shift from public.schedule_overrides where profile_id = p_profile and shift_date = p_date for update;
  if not found or current_shift.status_id is distinct from credit.worked_status_id
    or (credit.worked_override_id is not null and credit.worked_override_id <> current_shift.id) then
    raise exception 'The worked shift changed. Reload and check the current override.';
  end if;

  snapshot := credit.worked_override_before;
  linked_request := credit.annual_request_id;
  if credit.worked_override_id is null then
    -- Migration 038 logged the previous leave status and whether Annual was refunded.
    select a.detail into audit_detail from public.audit_log a
      where a.action = 'low_day.earned' and a.entity_id = p_profile::text
        and a.detail->>'credit_id' = credit.id::text order by a.created_at desc limit 1;
    if audit_detail->>'previous_status' in ('weekend', 'sick', 'vacation') then
      snapshot := jsonb_build_object('status_id', audit_detail->>'previous_status');
    end if;
    if audit_detail->>'annual_refund' = 'true' then
      select array_agg(id) into matching_requests from public.vacation_requests
        where profile_id = p_profile and status = 'approved' and p_date between start_date and end_date;
      if coalesce(cardinality(matching_requests), 0) <> 1 then
        raise exception 'This older Annual correction needs review because its original request cannot be identified.';
      end if;
      linked_request := matching_requests[1];
      snapshot := snapshot || jsonb_build_object('note', 'Vacation request ' || linked_request::text);
    end if;
  end if;

  if linked_request is not null then
    select * into request from public.vacation_requests
      where id = linked_request and profile_id = p_profile and status = 'approved'
        and p_date between start_date and end_date for update;
    if not found then raise exception 'The original Annual request is unavailable.'; end if;
    update public.annual_balance_years set remaining_days = remaining_days - 1, updated_at = now()
      where profile_id = p_profile and balance_year = yr and remaining_days > 0 returning * into balance;
    if not found then raise exception 'The Annual balance for % has no available day to restore the leave.', yr; end if;
    perform set_config('sport360.annual_action', 'approval', true);
    update public.employee_profiles set remaining_vacation_days = balance.remaining_days, updated_at = now()
      where id = p_profile and annual_balance_year = yr;
    perform set_config('sport360.annual_action', coalesce(prior_action, ''), true);
    update public.vacation_requests set deducted_days = deducted_days + 1,
      deducted_days_by_year = case when deducted_days_by_year = '{}'::jsonb then deducted_days_by_year
        else jsonb_set(deducted_days_by_year, array[yr::text],
          to_jsonb(coalesce((deducted_days_by_year->>yr::text)::integer, 0) + 1)) end
      where id = linked_request returning * into request;
    returned_balance := jsonb_build_object('request', to_jsonb(request), 'balance', to_jsonb(balance));
  end if;

  if snapshot is null then
    delete from public.schedule_overrides where id = current_shift.id;
  else
    update public.schedule_overrides set status_id = snapshot->>'status_id',
      note = snapshot->>'note', holiday_override_batch_id = (snapshot->>'holiday_override_batch_id')::uuid,
      updated_at = now() where id = current_shift.id returning * into restored;
  end if;
  delete from public.low_day_credits where id = credit.id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'low_day.work_cleared', 'profile', p_profile::text,
    jsonb_build_object('credit_id', credit.id, 'worked_date', p_date, 'restored_shift', restored.status_id,
      'annual_recharged', linked_request is not null));
  return jsonb_build_object('override', to_jsonb(restored), 'refund', returned_balance);
end;
$$;
revoke all on function public.clear_low_day_work(uuid,date) from public, anon, authenticated;
grant execute on function public.clear_low_day_work(uuid,date) to authenticated;

notify pgrst, 'reload schema';
commit;
