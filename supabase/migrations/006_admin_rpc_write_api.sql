-- Server-side admin write API.
-- Admin UI mutations use these RPC functions so writes are checked once
-- against public.profiles, then performed by trusted database functions.

create or replace function public.assert_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_add_person(
  p_name text,
  p_title text,
  p_department_id uuid,
  p_vacation_limit integer,
  p_display_order integer,
  p_default_shift_type_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_person_id uuid;
begin
  perform public.assert_admin();

  insert into public.people (name, title, department_id, vacation_limit, display_order)
  values (
    nullif(trim(p_name), ''),
    coalesce(nullif(trim(p_title), ''), 'Team Member'),
    p_department_id,
    greatest(coalesce(p_vacation_limit, 15), 0),
    coalesce(p_display_order, 0)
  )
  returning id into new_person_id;

  insert into public.person_defaults (person_id, weekday, shift_type_id)
  select
    new_person_id,
    weekday,
    case when weekday in (5, 6) then 'weekend' else p_default_shift_type_id end
  from generate_series(0, 6) as weekday;

  return new_person_id;
end;
$$;

create or replace function public.admin_update_person(
  p_person_id uuid,
  p_name text default null,
  p_title text default null,
  p_department_id uuid default null,
  p_vacation_limit integer default null,
  p_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  update public.people
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    title = coalesce(nullif(trim(p_title), ''), title),
    department_id = coalesce(p_department_id, department_id),
    vacation_limit = coalesce(greatest(p_vacation_limit, 0), vacation_limit),
    active = coalesce(p_active, active)
  where id = p_person_id;
end;
$$;

create or replace function public.admin_update_person_order(p_updates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  update public.people
  set display_order = updates.display_order
  from jsonb_to_recordset(p_updates) as updates(id uuid, display_order integer)
  where people.id = updates.id;
end;
$$;

create or replace function public.admin_upsert_person_default(
  p_person_id uuid,
  p_weekday smallint,
  p_shift_type_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  insert into public.person_defaults (person_id, weekday, shift_type_id)
  values (p_person_id, p_weekday, p_shift_type_id)
  on conflict (person_id, weekday)
  do update set shift_type_id = excluded.shift_type_id;
end;
$$;

create or replace function public.admin_upsert_schedule_override(
  p_person_id uuid,
  p_shift_date date,
  p_shift_type_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  insert into public.schedule_overrides (person_id, shift_date, shift_type_id, source, created_by)
  values (p_person_id, p_shift_date, p_shift_type_id, 'admin', auth.uid())
  on conflict (person_id, shift_date)
  do update set
    shift_type_id = excluded.shift_type_id,
    source = 'admin',
    request_id = null,
    created_by = auth.uid();
end;
$$;

create or replace function public.admin_delete_schedule_override(
  p_person_id uuid,
  p_shift_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  delete from public.schedule_overrides
  where person_id = p_person_id
    and shift_date = p_shift_date;
end;
$$;

create or replace function public.admin_clear_day(p_target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  delete from public.schedule_overrides where shift_date = p_target_date;
  delete from public.manager_overrides where manager_date = p_target_date;
end;
$$;

create or replace function public.admin_upsert_manager_default(
  p_department_id uuid,
  p_weekday smallint,
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  insert into public.manager_defaults (department_id, weekday, person_id)
  values (p_department_id, p_weekday, p_person_id)
  on conflict (department_id, weekday)
  do update set person_id = excluded.person_id;
end;
$$;

create or replace function public.admin_upsert_manager_override(
  p_department_id uuid,
  p_manager_date date,
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  insert into public.manager_overrides (department_id, manager_date, person_id, created_by)
  values (p_department_id, p_manager_date, p_person_id, auth.uid())
  on conflict (department_id, manager_date)
  do update set
    person_id = excluded.person_id,
    created_by = auth.uid();
end;
$$;

create or replace function public.admin_link_profile(
  p_profile_id uuid,
  p_person_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  update public.profiles
  set person_id = p_person_id,
      role = p_role
  where id = p_profile_id;
end;
$$;

create or replace function public.admin_review_time_off_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text,
  p_shift_type_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.time_off_requests%rowtype;
begin
  perform public.assert_admin();

  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid request status' using errcode = '22023';
  end if;

  select *
  into target_request
  from public.time_off_requests
  where id = p_request_id;

  if not found then
    raise exception 'Request not found' using errcode = '02000';
  end if;

  if p_status = 'approved' then
    insert into public.schedule_overrides (person_id, shift_date, shift_type_id, source, request_id, created_by)
    select
      target_request.person_id,
      day::date,
      p_shift_type_id,
      'request',
      target_request.id,
      auth.uid()
    from generate_series(target_request.start_date, target_request.end_date, interval '1 day') as day
    on conflict (person_id, shift_date)
    do update set
      shift_type_id = excluded.shift_type_id,
      source = 'request',
      request_id = excluded.request_id,
      created_by = auth.uid();
  end if;

  update public.time_off_requests
  set status = p_status,
      admin_note = coalesce(p_admin_note, ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.assert_admin() to authenticated;
grant execute on function public.admin_add_person(text, text, uuid, integer, integer, text) to authenticated;
grant execute on function public.admin_update_person(uuid, text, text, uuid, integer, boolean) to authenticated;
grant execute on function public.admin_update_person_order(jsonb) to authenticated;
grant execute on function public.admin_upsert_person_default(uuid, smallint, text) to authenticated;
grant execute on function public.admin_upsert_schedule_override(uuid, date, text) to authenticated;
grant execute on function public.admin_delete_schedule_override(uuid, date) to authenticated;
grant execute on function public.admin_clear_day(date) to authenticated;
grant execute on function public.admin_upsert_manager_default(uuid, smallint, uuid) to authenticated;
grant execute on function public.admin_upsert_manager_override(uuid, date, uuid) to authenticated;
grant execute on function public.admin_link_profile(uuid, uuid, text) to authenticated;
grant execute on function public.admin_review_time_off_request(uuid, text, text, text) to authenticated;
