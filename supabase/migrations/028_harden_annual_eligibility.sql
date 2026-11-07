create or replace function public.vacation_workday_count(
  p_profile_id uuid,
  p_start_date date,
  p_end_date date
)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  with requested_days as (
    select generated_day::date as shift_date
    from generate_series(p_start_date, p_end_date, interval '1 day') generated_day
  ),
  resolved_status as (
    select
      requested_days.shift_date,
      coalesce(
        override_status.status_id,
        case
          when rotation.id is null then null
          when array_length(rotation.pattern, 1) = 7 then rotation.pattern[extract(isodow from requested_days.shift_date)::int]
          else rotation.pattern[((requested_days.shift_date - rotation.effective_start) % array_length(rotation.pattern, 1)) + 1]
        end
      ) as status_id
    from requested_days
    left join public.schedule_overrides override_status
      on override_status.profile_id = p_profile_id
     and override_status.shift_date = requested_days.shift_date
    left join lateral (
      select rotation_version.*
      from public.rotation_versions rotation_version
      where rotation_version.profile_id = p_profile_id
        and rotation_version.effective_start <= requested_days.shift_date
      order by rotation_version.effective_start desc
      limit 1
    ) rotation on true
  )
  select count(*)::integer
  from resolved_status
  join public.shift_statuses status on status.id = resolved_status.status_id
  where status.kind = 'working'
    and resolved_status.status_id not in ('weekend', 'sick', 'vacation');
$$;

create or replace function public.apply_vacation_overrides(
  p_profile_id uuid,
  p_start_date date,
  p_end_date date,
  p_request_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.schedule_overrides (profile_id, shift_date, status_id, note, created_by)
  select
    p_profile_id,
    requested_days.shift_date,
    'vacation',
    'Vacation request ' || p_request_id::text,
    auth.uid()
  from (
    select generated_day::date as shift_date
    from generate_series(p_start_date, p_end_date, interval '1 day') generated_day
  ) requested_days
  where public.vacation_workday_count(
    p_profile_id,
    requested_days.shift_date,
    requested_days.shift_date
  ) = 1
  on conflict (profile_id, shift_date)
  do update set
    status_id = excluded.status_id,
    note = excluded.note,
    updated_at = now()
  where public.schedule_overrides.status_id not in ('weekend', 'sick', 'vacation');
$$;

create or replace function public.validate_vacation_request_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending'
    and public.vacation_workday_count(new.profile_id, new.start_date, new.end_date) = 0
  then
    raise exception 'Annual requests require at least one eligible working day';
  end if;

  return new;
end;
$$;

drop trigger if exists vacation_requests_require_eligible_day on public.vacation_requests;
create trigger vacation_requests_require_eligible_day
before insert or update of profile_id, start_date, end_date
on public.vacation_requests
for each row execute function public.validate_vacation_request_eligibility();

create or replace function public.decide_vacation_request(
  p_request_id uuid,
  p_decision public.vacation_status
)
returns public.vacation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.vacation_requests;
  target_profile public.employee_profiles;
  deducted integer := 0;
  decided_request public.vacation_requests;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into target_request
  from public.vacation_requests
  where id = p_request_id
  for update;

  if target_request.id is null then
    raise exception 'Vacation request not found';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'Only pending vacation requests can be decided';
  end if;

  select * into target_profile
  from public.employee_profiles
  where id = target_request.profile_id
  for update;

  if target_profile.id is null then
    raise exception 'Vacation request profile not found';
  end if;

  if not (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'lead'
      and public.current_user_can_manage_profile(target_profile.id)
    )
  ) then
    raise exception 'Not allowed to decide this vacation request';
  end if;

  if p_decision = 'approved' then
    deducted := public.vacation_workday_count(
      target_request.profile_id,
      target_request.start_date,
      target_request.end_date
    );

    if deducted = 0 then
      raise exception 'No eligible working days remain in this annual request';
    end if;

    if target_profile.remaining_vacation_days < deducted then
      raise exception 'Insufficient vacation balance';
    end if;

    update public.employee_profiles
    set remaining_vacation_days = remaining_vacation_days - deducted,
        updated_at = now()
    where id = target_profile.id;

    perform public.apply_vacation_overrides(
      target_request.profile_id,
      target_request.start_date,
      target_request.end_date,
      target_request.id
    );
  end if;

  update public.vacation_requests
  set status = p_decision,
      decided_by = auth.uid(),
      decided_at = now(),
      deducted_days = case when p_decision = 'approved' then deducted else 0 end
  where id = target_request.id
  returning * into decided_request;

  return decided_request;
end;
$$;

revoke all on function public.vacation_workday_count(uuid, date, date) from public, anon;
revoke all on function public.apply_vacation_overrides(uuid, date, date, uuid) from public, anon;
revoke all on function public.validate_vacation_request_eligibility() from public, anon, authenticated;
revoke all on function public.decide_vacation_request(uuid, public.vacation_status) from public, anon;

grant execute on function public.vacation_workday_count(uuid, date, date) to authenticated;
grant execute on function public.apply_vacation_overrides(uuid, date, date, uuid) to authenticated;
grant execute on function public.decide_vacation_request(uuid, public.vacation_status) to authenticated;

select pg_notify('pgrst', 'reload schema');
