-- Rollback-safe audit for department-wide rotation saves.
-- Every allowed write is deliberately rolled back. No rotation rows are retained.

drop table if exists pg_temp.rotation_batch_subjects;
drop table if exists pg_temp.rotation_batch_results;
drop function if exists pg_temp.run_rotation_batch_check(text, text, text, text, integer);
drop function if exists pg_temp.run_rotation_history_check();

create temp table rotation_batch_subjects (
  role_name text primary key,
  user_id uuid not null
);

insert into pg_temp.rotation_batch_subjects (role_name, user_id)
select expected.role_name, actual.user_id
from (values ('admin'::text), ('lead'::text), ('employee'::text)) expected(role_name)
join lateral (
  select role.user_id
  from public.user_roles role
  join public.employee_profiles profile on profile.user_id = role.user_id
  where role.role::text = expected.role_name
  order by role.created_at
  limit 1
) actual on true;

create temp table rotation_batch_results (
  role_name text not null,
  check_name text not null,
  audit_status text not null,
  details text not null
);

create function pg_temp.run_rotation_batch_check(
  p_role_name text,
  p_check_name text,
  p_expected text,
  p_sql text,
  p_expected_rows integer default null
)
returns table (role_name text, check_name text, audit_status text, details text)
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
    raise exception using errcode = 'P0002', message = 'rotation audit rollback';
  exception
    when sqlstate 'P0002' then
      role_name := p_role_name;
      check_name := p_check_name;
      audit_status := case
        when p_expected = 'allow' and (p_expected_rows is null or affected_rows = p_expected_rows) then 'pass'
        when p_expected = 'deny' then 'fail'
        else 'fail'
      end;
      details := 'expected=' || p_expected || ', statement succeeded, rows=' || affected_rows::text;
      return next;
    when others then
      get stacked diagnostics error_state = returned_sqlstate, error_message = message_text;
      role_name := p_role_name;
      check_name := p_check_name;
      audit_status := case when p_expected = 'deny' then 'pass' else 'fail' end;
      details := 'expected=' || p_expected || ', sqlstate=' || error_state || ', message=' || error_message;
      return next;
  end;
end;
$$;

create function pg_temp.run_rotation_history_check()
returns table (role_name text, check_name text, audit_status text, details text)
language plpgsql
as $$
declare
  target_department uuid;
  test_date date := current_date + 6100;
  historical_before integer;
  historical_after integer;
  inserted_rows integer;
  selected_profiles integer;
begin
  select profile.department_id into target_department
  from public.employee_profiles profile
  where profile.id = public.current_profile_id();

  begin
    select count(*) into selected_profiles
    from (
      select id from public.employee_profiles
      where department_id = target_department
      order by created_at
      limit 2
    ) profiles;

    select count(*) into historical_before
    from public.rotation_versions rotation
    join public.employee_profiles profile on profile.id = rotation.profile_id
    where profile.department_id = target_department
      and rotation.effective_start < test_date;

    perform * from public.save_department_rotation_versions(
      target_department,
      test_date,
      (
        select jsonb_agg(jsonb_build_object(
          'profileId', profile.id,
          'pattern', jsonb_build_array('morning', 'morning', 'midday', 'night', 'night', 'weekend', 'weekend')
        ))
        from (
          select id from public.employee_profiles
          where department_id = target_department
          order by created_at
          limit 2
        ) profile
      )
    );

    select count(*) into historical_after
    from public.rotation_versions rotation
    join public.employee_profiles profile on profile.id = rotation.profile_id
    where profile.department_id = target_department
      and rotation.effective_start < test_date;

    select count(*) into inserted_rows
    from public.rotation_versions rotation
    join public.employee_profiles profile on profile.id = rotation.profile_id
    where profile.department_id = target_department
      and rotation.effective_start = test_date;

    raise exception using errcode = 'P0002', message = 'rotation history audit rollback';
  exception
    when sqlstate 'P0002' then
      role_name := 'admin';
      check_name := 'history preserved with new versions';
      audit_status := case
        when historical_before = historical_after and inserted_rows = selected_profiles and selected_profiles > 0 then 'pass'
        else 'fail'
      end;
      details := 'historical before=' || historical_before::text
        || ', after=' || historical_after::text
        || ', selected=' || selected_profiles::text
        || ', new=' || inserted_rows::text;
      return next;
    when others then
      role_name := 'admin';
      check_name := 'history preserved with new versions';
      audit_status := 'fail';
      details := sqlerrm;
      return next;
  end;
end;
$$;

grant select on pg_temp.rotation_batch_subjects to authenticated;
grant select, insert on pg_temp.rotation_batch_results to authenticated;
grant execute on function pg_temp.run_rotation_batch_check(text, text, text, text, integer) to authenticated;
grant execute on function pg_temp.run_rotation_history_check() to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from pg_temp.rotation_batch_subjects where role_name = 'admin'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_history_check();

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_batch_check(
  'admin',
  'invalid status rejected',
  'deny',
  $sql$
    select * from public.save_department_rotation_versions(
      (select department_id from public.employee_profiles where id = public.current_profile_id()),
      current_date + 6101,
      jsonb_build_array(jsonb_build_object(
        'profileId', public.current_profile_id(),
        'pattern', jsonb_build_array('vacation', 'morning', 'morning', 'morning', 'morning', 'weekend', 'weekend')
      ))
    )
  $sql$,
  null
);

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_batch_check(
  'admin',
  'atomic failure on mixed departments',
  'deny',
  $sql$
    select * from public.save_department_rotation_versions(
      (select department_id from public.employee_profiles where id = public.current_profile_id()),
      current_date + 6102,
      (
        select jsonb_agg(jsonb_build_object(
          'profileId', profile.id,
          'pattern', jsonb_build_array('morning', 'morning', 'morning', 'morning', 'morning', 'weekend', 'weekend')
        ) order by profile.same_department desc)
        from (
          select id, department_id = (select department_id from public.employee_profiles where id = public.current_profile_id()) as same_department
          from public.employee_profiles
          where department_id is not null
            and (
              id = public.current_profile_id()
              or department_id <> (select department_id from public.employee_profiles where id = public.current_profile_id())
            )
          order by same_department desc
          limit 2
        ) profile
      )
    )
  $sql$,
  null
);

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from pg_temp.rotation_batch_subjects where role_name = 'lead'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_batch_check(
  'lead',
  'future own-department batch',
  'allow',
  $sql$
    select * from public.save_department_rotation_versions(
      public.current_profile_department(),
      current_date + 6103,
      jsonb_build_array(jsonb_build_object(
        'profileId', public.current_profile_id(),
        'pattern', jsonb_build_array('morning', 'midday', 'night', 'morning', 'night', 'weekend', 'weekend')
      ))
    )
  $sql$,
  1
);

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_batch_check(
  'lead',
  'past batch blocked',
  'deny',
  $sql$
    select * from public.save_department_rotation_versions(
      public.current_profile_department(),
      date '1900-01-01',
      jsonb_build_array(jsonb_build_object(
        'profileId', public.current_profile_id(),
        'pattern', jsonb_build_array('morning', 'morning', 'morning', 'morning', 'morning', 'weekend', 'weekend')
      ))
    )
  $sql$,
  null
);

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_batch_check(
  'lead',
  'other department blocked',
  'deny',
  $sql$
    select * from public.save_department_rotation_versions(
      (select department_id from public.employee_profiles where department_id <> public.current_profile_department() order by created_at limit 1),
      current_date + 6104,
      (
        select jsonb_build_array(jsonb_build_object(
          'profileId', id,
          'pattern', jsonb_build_array('morning', 'morning', 'morning', 'morning', 'morning', 'weekend', 'weekend')
        ))
        from public.employee_profiles
        where department_id <> public.current_profile_department()
        order by created_at
        limit 1
      )
    )
  $sql$,
  null
);

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from pg_temp.rotation_batch_subjects where role_name = 'employee'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into pg_temp.rotation_batch_results
select * from pg_temp.run_rotation_batch_check(
  'employee',
  'batch save blocked',
  'deny',
  $sql$
    select * from public.save_department_rotation_versions(
      (select department_id from public.employee_profiles where id = public.current_profile_id()),
      current_date + 6105,
      jsonb_build_array(jsonb_build_object(
        'profileId', public.current_profile_id(),
        'pattern', jsonb_build_array('morning', 'morning', 'morning', 'morning', 'morning', 'weekend', 'weekend')
      ))
    )
  $sql$,
  null
);

reset role;

insert into pg_temp.rotation_batch_results
select
  'admin',
  'atomic failure left no rows',
  case when count(*) = 0 then 'pass' else 'fail' end,
  'retained rows=' || count(*)::text
from public.rotation_versions
where effective_start = current_date + 6102;

select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

select role_name, check_name, audit_status, details
from pg_temp.rotation_batch_results
order by case audit_status when 'fail' then 1 else 2 end, role_name, check_name;
