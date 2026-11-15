begin;

-- Track explicit edits made after a public holiday was assigned to this shift.
alter table public.schedule_overrides add column holiday_override_batch_id uuid;

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
            where c.profile_id = profile.id and c.worked_date = h.holiday_date)
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
