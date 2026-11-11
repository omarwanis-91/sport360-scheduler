begin;

create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null check (length(trim(name)) between 1 and 100),
  department_ids uuid[] not null default '{}',
  day_off boolean not null,
  updated_at timestamptz not null default now()
);

create table public.low_day_credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  worked_date date not null,
  due_date date generated always as (worked_date + 30) stored,
  worked_status_id text not null references public.shift_statuses(id),
  reason text not null check (reason in ('day_off', 'public_holiday')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  replacement_date date,
  prior_override jsonb,
  unique (profile_id, worked_date),
  check (replacement_date > worked_date and replacement_date <= worked_date + 30)
);

alter table public.public_holidays enable row level security;
alter table public.low_day_credits enable row level security;
revoke all on public.public_holidays, public.low_day_credits from public, anon, authenticated;
create unique index low_day_replacement_per_date on public.low_day_credits(profile_id, replacement_date)
  where replacement_date is not null;

insert into public.shift_statuses (id, label, kind, color, sort_order)
values ('low_day', 'Replacement Day', 'off', '#ad89ce', 95);

create function public.holiday_covers_profile(p_profile uuid, p_departments uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select cardinality(p_departments) = 0 or exists (
    select 1 from unnest(p_departments) as team(id)
    where public.profile_directly_belongs_to_department(p_profile, team.id)
  )
$$;

create function public.rotation_status_on(p_profile uuid, p_date date)
returns text language sql stable security definer set search_path = public as $$
  select case when array_length(r.pattern, 1) = 7 then r.pattern[extract(isodow from p_date)::integer]
              else r.pattern[((p_date - r.effective_start) % array_length(r.pattern, 1)) + 1] end
  from public.rotation_versions r
  where r.profile_id = p_profile and r.effective_start <= p_date
  order by r.effective_start desc limit 1
$$;

-- A daily override takes precedence. Existing approved Annual stays on its original record.
create or replace function public.annual_eligible_dates(p_profile_id uuid, p_start date, p_end date)
returns table(shift_date date) language sql stable security definer set search_path = public as $$
  select d.day::date
  from generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') d(day)
  left join public.schedule_overrides o on o.profile_id = p_profile_id and o.shift_date = d.day::date
  join public.shift_statuses s on s.id = coalesce(o.status_id, public.rotation_status_on(p_profile_id, d.day::date))
  where s.kind = 'working' and s.id not in ('weekend', 'sick', 'vacation', 'low_day')
    and not exists (select 1 from public.low_day_credits c where c.profile_id = p_profile_id and c.worked_date = d.day::date)
    and (o.id is not null or not exists (
      select 1 from public.public_holidays h
      where h.holiday_date = d.day::date and h.day_off
        and public.holiday_covers_profile(p_profile_id, h.department_ids)
    ))
$$;

create or replace function public.vacation_workday_count(p_profile_id uuid, p_start_date date, p_end_date date)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.annual_eligible_dates(p_profile_id, p_start_date, p_end_date)
$$;
revoke all on function public.vacation_workday_count(uuid,date,date) from public, anon, authenticated;

-- Browser clients can use ordinary overrides, but replacement days must go through the booking RPC.
create function public.guard_low_day_override()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and
      ((tg_op <> 'INSERT' and old.status_id = 'low_day') or (tg_op <> 'DELETE' and new.status_id = 'low_day')) then
    raise exception 'Manage replacement days in Team Alerts.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_low_day_override before insert or update or delete on public.schedule_overrides
  for each row execute function public.guard_low_day_override();

create function public.calendar_holiday_rows(p_profiles uuid[], p_year integer default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'date', h.holiday_date, 'name', h.name, 'dayOff', h.day_off,
    'organizationWide', cardinality(h.department_ids) = 0,
    'departmentIds', case when p_year is null then array(select id from unnest(h.department_ids) team(id)
      where public.current_user_can_access_department(id)) else '{}'::uuid[] end,
    'profileIds', affected.ids
  ) order by h.holiday_date), '[]'::jsonb)
  from public.public_holidays h
  cross join lateral (
    select array(select id from unnest(p_profiles) profile(id)
      where public.holiday_covers_profile(id, h.department_ids)) as ids
  ) affected
  where (p_year is null or h.holiday_date between make_date(p_year, 1, 1) and make_date(p_year, 12, 31))
    and (cardinality(affected.ids) > 0 or (p_year is null and (
      public.current_role() = 'admin' or cardinality(h.department_ids) = 0
      or exists (select 1 from unnest(h.department_ids) team(id)
        where public.current_user_can_access_department(id)))))
$$;

create function public.get_low_day_calendar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_claimed_user() is not true then
    raise exception 'Profile access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
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

create function public.save_public_holiday(
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
  select * into prior from public.public_holidays where id = p_id;
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

create function public.confirm_low_day_work(p_profile uuid, p_date date, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Africa/Cairo')::date;
  holiday boolean;
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
    and public.holiday_covers_profile(p_profile, h.department_ids)) into holiday;
  select * into prior from public.schedule_overrides where profile_id = p_profile and shift_date = p_date for update;
  if prior.status_id in ('vacation', 'sick', 'low_day') then
    raise exception 'This date already has leave or a replacement day.';
  end if;
  if not holiday and prior.status_id is distinct from 'weekend'
    and public.rotation_status_on(p_profile, p_date) is distinct from 'weekend' then
    raise exception 'Choose a scheduled day off or public holiday.';
  end if;

  if prior.id is null then
    insert into public.schedule_overrides (profile_id, shift_date, status_id, note, created_by)
    values (p_profile, p_date, p_status, nullif(trim(p_note), ''), auth.uid()) returning * into saved;
  else
    update public.schedule_overrides set status_id = p_status,
      note = coalesce(nullif(trim(p_note), ''), case when prior.status_id <> 'weekend' then prior.note end),
      updated_at = now() where id = prior.id returning * into saved;
  end if;
  insert into public.low_day_credits (profile_id, worked_date, worked_status_id, reason, confirmed_by)
  values (p_profile, p_date, p_status, case when holiday then 'public_holiday' else 'day_off' end, auth.uid())
  returning * into credit;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'low_day.earned', 'profile', p_profile::text,
    jsonb_build_object('credit_id', credit.id, 'worked_date', p_date, 'due_date', credit.due_date, 'reason', credit.reason));
  return jsonb_build_object('credit', to_jsonb(credit) - 'prior_override', 'override', to_jsonb(saved));
end;
$$;

create function public.book_low_day(p_credit uuid, p_date date)
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
      and public.holiday_covers_profile(credit.profile_id, h.department_ids)) then
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

-- Keep the existing analytics authorization and augment its scoped snapshot.
alter function public.get_schedule_analytics(integer, uuid, boolean) rename to get_schedule_analytics_base;
revoke all on function public.get_schedule_analytics_base(integer, uuid, boolean) from public, anon, authenticated;
create function public.get_schedule_analytics(p_year integer, p_department_id uuid default null, p_direct_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare snapshot jsonb := public.get_schedule_analytics_base(p_year, p_department_id, p_direct_only);
begin
  return snapshot || jsonb_build_object('publicHolidays', public.calendar_holiday_rows(array(
    select (p->>'id')::uuid from jsonb_array_elements(snapshot->'profiles') p
  ), p_year));
end;
$$;

revoke all on function public.holiday_covers_profile(uuid, uuid[]), public.rotation_status_on(uuid, date),
  public.calendar_holiday_rows(uuid[], integer), public.guard_low_day_override() from public, anon, authenticated;
revoke all on function public.get_low_day_calendar(), public.save_public_holiday(uuid,date,text,uuid[],boolean,boolean),
  public.confirm_low_day_work(uuid,date,text,text), public.book_low_day(uuid,date),
  public.get_schedule_analytics(integer,uuid,boolean) from public, anon;
grant execute on function public.get_low_day_calendar(), public.save_public_holiday(uuid,date,text,uuid[],boolean,boolean),
  public.confirm_low_day_work(uuid,date,text,text), public.book_low_day(uuid,date),
  public.get_schedule_analytics(integer,uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
