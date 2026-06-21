-- Rollback-safe role write audit.
-- Successful writes are rolled back inside subtransactions. No application rows are retained.

drop table if exists pg_temp.role_write_subjects;
drop table if exists pg_temp.role_write_results;
drop function if exists pg_temp.run_write_check(text, text, text, text, text);

create temp table role_write_subjects (
  role_name text primary key,
  user_id uuid not null
);

insert into pg_temp.role_write_subjects (role_name, user_id)
select expected.role_name, actual.user_id
from (
  values ('admin'::text), ('lead'::text), ('employee'::text)
) expected(role_name)
join lateral (
  select role.user_id
  from public.user_roles role
  join public.employee_profiles profile on profile.user_id = role.user_id
  where role.role::text = expected.role_name
  order by role.created_at
  limit 1
) actual on true;

create temp table role_write_results (
  role_name text not null,
  check_name text not null,
  audit_status text not null,
  details text not null
);

create function pg_temp.run_write_check(
  p_role_name text,
  p_check_name text,
  p_expected text,
  p_sql text,
  p_expected_error text default null
)
returns table (
  role_name text,
  check_name text,
  audit_status text,
  details text
)
language plpgsql
as $$
declare
  affected_rows integer := 0;
  error_state text;
  error_message text;
begin
  begin
    execute p_sql;
    get diagnostics affected_rows = row_count;
    raise exception using errcode = 'P0002', message = 'role audit rollback';
  exception
    when sqlstate 'P0002' then
      role_name := p_role_name;
      check_name := p_check_name;
      audit_status := case
        when p_expected = 'allow' and affected_rows > 0 then 'pass'
        when p_expected = 'deny' and affected_rows = 0 then 'pass'
        else 'fail'
      end;
      details := 'expected=' || p_expected || ', statement succeeded, rows=' || affected_rows::text;
      return next;
    when others then
      get stacked diagnostics
        error_state = returned_sqlstate,
        error_message = message_text;
      role_name := p_role_name;
      check_name := p_check_name;
      audit_status := case
        when p_expected = 'deny'
          and (p_expected_error is null or error_state = p_expected_error)
        then 'pass'
        else 'fail'
      end;
      details := 'expected=' || p_expected || ', sqlstate=' || error_state || ', message=' || error_message;
      return next;
  end;
end;
$$;

grant select on pg_temp.role_write_subjects to authenticated;
grant select, insert on pg_temp.role_write_results to authenticated;
grant execute on function pg_temp.run_write_check(text, text, text, text, text) to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from pg_temp.role_write_subjects where role_name = 'admin'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'admin',
  'manage departments',
  'allow',
  $sql$update public.departments set name = name where id = (select id from public.departments order by created_at limit 1)$sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'admin',
  'manage statuses',
  'allow',
  $sql$update public.shift_statuses set label = label where id = (select id from public.shift_statuses order by sort_order limit 1)$sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'admin',
  'manage profiles',
  'allow',
  $sql$update public.employee_profiles set full_name = full_name where id = public.current_profile_id()$sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'admin',
  'correct past schedule',
  'allow',
  $sql$
    insert into public.schedule_overrides (id, profile_id, shift_date, status_id, note, created_by)
    values (gen_random_uuid(), public.current_profile_id(), date '1900-01-01', 'weekend', 'role audit', auth.uid())
  $sql$,
  null
);

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from pg_temp.role_write_subjects where role_name = 'lead'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'lead',
  'manage departments blocked',
  'deny',
  $sql$update public.departments set name = name where id = public.current_profile_department()$sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'lead',
  'future own-department override',
  'allow',
  $sql$
    insert into public.schedule_overrides (id, profile_id, shift_date, status_id, note, created_by)
    values (gen_random_uuid(), public.current_profile_id(), current_date + 3650, 'weekend', 'role audit', auth.uid())
  $sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'lead',
  'past override blocked',
  'deny',
  $sql$
    insert into public.schedule_overrides (id, profile_id, shift_date, status_id, note, created_by)
    values (gen_random_uuid(), public.current_profile_id(), date '1900-01-02', 'weekend', 'role audit', auth.uid())
  $sql$,
  '42501'
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'lead',
  'other-department override blocked',
  'deny',
  $sql$
    insert into public.schedule_overrides (id, profile_id, shift_date, status_id, note, created_by)
    select gen_random_uuid(), profile.id, current_date + 3651, 'weekend', 'role audit', auth.uid()
    from public.employee_profiles profile
    where profile.department_id <> public.current_profile_department()
    order by profile.created_at
    limit 1
  $sql$,
  '42501'
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'lead',
  'future own rotation',
  'allow',
  $sql$
    insert into public.rotation_versions (id, profile_id, effective_start, pattern, created_by)
    values (gen_random_uuid(), public.current_profile_id(), current_date + 3650, array['morning','morning','morning','morning','morning','weekend','weekend'], auth.uid())
  $sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'lead',
  'past rotation blocked',
  'deny',
  $sql$
    insert into public.rotation_versions (id, profile_id, effective_start, pattern, created_by)
    values (gen_random_uuid(), public.current_profile_id(), date '1900-01-03', array['morning','morning','morning','morning','morning','weekend','weekend'], auth.uid())
  $sql$,
  '42501'
);

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from pg_temp.role_write_subjects where role_name = 'employee'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'manage departments blocked',
  'deny',
  $sql$update public.departments set name = name where id = (select id from public.departments order by created_at limit 1)$sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'schedule override blocked',
  'deny',
  $sql$
    insert into public.schedule_overrides (id, profile_id, shift_date, status_id, note, created_by)
    values (gen_random_uuid(), public.current_profile_id(), current_date + 3652, 'weekend', 'role audit', auth.uid())
  $sql$,
  '42501'
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'own vacation request',
  'allow',
  $sql$
    insert into public.vacation_requests (id, profile_id, start_date, end_date, reason, status)
    values (gen_random_uuid(), public.current_profile_id(), current_date + 3653, current_date + 3654, 'role audit', 'pending')
  $sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'other-profile vacation blocked',
  'deny',
  $sql$
    insert into public.vacation_requests (id, profile_id, start_date, end_date, reason, status)
    select gen_random_uuid(), profile.id, current_date + 3655, current_date + 3656, 'role audit', 'pending'
    from public.employee_profiles profile
    where profile.id <> public.current_profile_id()
    order by profile.created_at
    limit 1
  $sql$,
  '42501'
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'direct profile update blocked',
  'deny',
  $sql$update public.employee_profiles set full_name = full_name where id = public.current_profile_id()$sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'own profile RPC',
  'allow',
  $sql$
    select public.update_own_profile(
      public.current_profile_id(),
      (select full_name from public.employee_profiles where id = public.current_profile_id()),
      (select photo_url from public.employee_profiles where id = public.current_profile_id())
    )
  $sql$,
  null
);

insert into pg_temp.role_write_results
select * from pg_temp.run_write_check(
  'employee',
  'other profile RPC blocked',
  'deny',
  $sql$
    select public.update_own_profile(
      (select id from public.employee_profiles where id <> public.current_profile_id() order by created_at limit 1),
      'role audit',
      null
    )
  $sql$,
  'P0001'
);

reset role;

select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

select role_name, check_name, audit_status, details
from pg_temp.role_write_results
order by
  case audit_status when 'fail' then 1 else 2 end,
  role_name,
  check_name;

