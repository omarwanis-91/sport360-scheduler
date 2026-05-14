-- Make admin write RPCs return the affected rows.
-- This prevents silent no-op writes from looking successful in the client.

drop function if exists public.admin_upsert_schedule_override(uuid, date, text);
create or replace function public.admin_upsert_schedule_override(
  p_person_id uuid,
  p_shift_date date,
  p_shift_type_id text
)
returns public.schedule_overrides
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_row public.schedule_overrides;
begin
  perform public.assert_admin();

  insert into public.schedule_overrides (person_id, shift_date, shift_type_id, source, created_by)
  values (p_person_id, p_shift_date, p_shift_type_id, 'admin', auth.uid())
  on conflict (person_id, shift_date)
  do update set
    shift_type_id = excluded.shift_type_id,
    source = 'admin',
    request_id = null,
    created_by = auth.uid()
  returning * into changed_row;

  if changed_row.id is null then
    raise exception 'Schedule override was not saved' using errcode = 'P0001';
  end if;

  return changed_row;
end;
$$;

drop function if exists public.admin_delete_schedule_override(uuid, date);
create or replace function public.admin_delete_schedule_override(
  p_person_id uuid,
  p_shift_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  perform public.assert_admin();

  delete from public.schedule_overrides
  where person_id = p_person_id
    and shift_date = p_shift_date;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

drop function if exists public.admin_upsert_person_default(uuid, smallint, text);
create or replace function public.admin_upsert_person_default(
  p_person_id uuid,
  p_weekday smallint,
  p_shift_type_id text
)
returns public.person_defaults
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_row public.person_defaults;
begin
  perform public.assert_admin();

  insert into public.person_defaults (person_id, weekday, shift_type_id)
  values (p_person_id, p_weekday, p_shift_type_id)
  on conflict (person_id, weekday)
  do update set shift_type_id = excluded.shift_type_id
  returning * into changed_row;

  if changed_row.person_id is null then
    raise exception 'Person default was not saved' using errcode = 'P0001';
  end if;

  return changed_row;
end;
$$;

drop function if exists public.admin_upsert_manager_default(uuid, smallint, uuid);
create or replace function public.admin_upsert_manager_default(
  p_department_id uuid,
  p_weekday smallint,
  p_person_id uuid
)
returns public.manager_defaults
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_row public.manager_defaults;
begin
  perform public.assert_admin();

  insert into public.manager_defaults (department_id, weekday, person_id)
  values (p_department_id, p_weekday, p_person_id)
  on conflict (department_id, weekday)
  do update set person_id = excluded.person_id
  returning * into changed_row;

  if changed_row.department_id is null then
    raise exception 'Manager default was not saved' using errcode = 'P0001';
  end if;

  return changed_row;
end;
$$;

drop function if exists public.admin_upsert_manager_override(uuid, date, uuid);
create or replace function public.admin_upsert_manager_override(
  p_department_id uuid,
  p_manager_date date,
  p_person_id uuid
)
returns public.manager_overrides
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_row public.manager_overrides;
begin
  perform public.assert_admin();

  insert into public.manager_overrides (department_id, manager_date, person_id, created_by)
  values (p_department_id, p_manager_date, p_person_id, auth.uid())
  on conflict (department_id, manager_date)
  do update set
    person_id = excluded.person_id,
    created_by = auth.uid()
  returning * into changed_row;

  if changed_row.id is null then
    raise exception 'Manager override was not saved' using errcode = 'P0001';
  end if;

  return changed_row;
end;
$$;

grant execute on function public.admin_upsert_schedule_override(uuid, date, text) to authenticated;
grant execute on function public.admin_delete_schedule_override(uuid, date) to authenticated;
grant execute on function public.admin_upsert_person_default(uuid, smallint, text) to authenticated;
grant execute on function public.admin_upsert_manager_default(uuid, smallint, uuid) to authenticated;
grant execute on function public.admin_upsert_manager_override(uuid, date, uuid) to authenticated;
