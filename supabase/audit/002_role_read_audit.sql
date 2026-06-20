-- Read-only role audit.
-- This script uses temporary tables and simulated JWT subjects. It does not change application data.

drop table if exists pg_temp.role_audit_results;
drop table if exists pg_temp.role_audit_subjects;

create temp table role_audit_subjects (
  role_name text primary key,
  user_id uuid not null,
  expected_role text not null,
  subject_exists boolean not null
);

insert into role_audit_subjects (role_name, user_id, expected_role, subject_exists)
select
  expected.role_name,
  coalesce(actual.user_id, gen_random_uuid()),
  expected.expected_role,
  actual.user_id is not null
from (
  values
    ('admin'::text, 'admin'::text),
    ('lead'::text, 'lead'::text),
    ('employee'::text, 'employee'::text)
) expected(role_name, expected_role)
left join lateral (
  select role.user_id
  from public.user_roles role
  join public.employee_profiles profile on profile.user_id = role.user_id
  where role.role::text = expected.expected_role
  order by role.created_at
  limit 1
) actual on true;

insert into role_audit_subjects (role_name, user_id, expected_role, subject_exists)
values ('unmatched', gen_random_uuid(), 'employee', true);

create temp table role_audit_results (
  role_name text not null,
  check_name text not null,
  audit_status text not null,
  details text not null
);

grant select on role_audit_subjects to authenticated;
grant select, insert on role_audit_results to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from role_audit_subjects where role_name = 'admin'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into role_audit_results
select
  'admin',
  'linked identity',
  case
    when not subject.subject_exists then 'skip'
    when public.current_role()::text = 'admin' and public.is_claimed_user() then 'pass'
    else 'fail'
  end,
  case when subject.subject_exists
    then 'role=' || public.current_role()::text || ', claimed=' || public.is_claimed_user()::text
    else 'no linked Admin account found'
  end
from role_audit_subjects subject
where subject.role_name = 'admin';

insert into role_audit_results
select
  'admin',
  'application reads',
  case when subject.subject_exists then 'pass' else 'skip' end,
  case when subject.subject_exists
    then 'profiles=' || (select count(*) from public.employee_profiles)::text
      || ', departments=' || (select count(*) from public.departments)::text
      || ', audit=' || (select count(*) from public.audit_log)::text
    else 'no linked Admin account found'
  end
from role_audit_subjects subject
where subject.role_name = 'admin';

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from role_audit_subjects where role_name = 'lead'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into role_audit_results
select
  'lead',
  'linked identity',
  case
    when not subject.subject_exists then 'skip'
    when public.current_role()::text = 'lead' and public.is_claimed_user() then 'pass'
    else 'fail'
  end,
  case when subject.subject_exists
    then 'role=' || public.current_role()::text || ', claimed=' || public.is_claimed_user()::text
    else 'no linked Department Lead account found'
  end
from role_audit_subjects subject
where subject.role_name = 'lead';

insert into role_audit_results
select
  'lead',
  'restricted reads',
  case
    when not subject.subject_exists then 'skip'
    when (select count(*) from public.audit_log) = 0
      and (select count(*) from public.user_roles) = 1
      and not exists (
        select 1
        from public.vacation_requests request
        join public.employee_profiles profile on profile.id = request.profile_id
        where profile.department_id <> public.current_profile_department()
      )
    then 'pass'
    else 'fail'
  end,
  case when subject.subject_exists
    then 'visible roles=' || (select count(*) from public.user_roles)::text
      || ', audit=' || (select count(*) from public.audit_log)::text
      || ', cross-department requests=' || (
        select count(*)
        from public.vacation_requests request
        join public.employee_profiles profile on profile.id = request.profile_id
        where profile.department_id <> public.current_profile_department()
      )::text
    else 'no linked Department Lead account found'
  end
from role_audit_subjects subject
where subject.role_name = 'lead';

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from role_audit_subjects where role_name = 'employee'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into role_audit_results
select
  'employee',
  'linked identity',
  case
    when not subject.subject_exists then 'skip'
    when public.current_role()::text = 'employee' and public.is_claimed_user() then 'pass'
    else 'fail'
  end,
  case when subject.subject_exists
    then 'role=' || public.current_role()::text || ', claimed=' || public.is_claimed_user()::text
    else 'no linked Employee account found'
  end
from role_audit_subjects subject
where subject.role_name = 'employee';

insert into role_audit_results
select
  'employee',
  'restricted reads',
  case
    when not subject.subject_exists then 'skip'
    when (select count(*) from public.audit_log) = 0
      and (select count(*) from public.user_roles) = 1
      and not exists (
        select 1
        from public.vacation_requests request
        where request.profile_id <> public.current_profile_id()
      )
    then 'pass'
    else 'fail'
  end,
  case when subject.subject_exists
    then 'visible roles=' || (select count(*) from public.user_roles)::text
      || ', audit=' || (select count(*) from public.audit_log)::text
      || ', other-profile requests=' || (
        select count(*)
        from public.vacation_requests request
        where request.profile_id <> public.current_profile_id()
      )::text
    else 'no linked Employee account found'
  end
from role_audit_subjects subject
where subject.role_name = 'employee';

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from role_audit_subjects where role_name = 'unmatched'), false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

insert into role_audit_results
select
  'unmatched',
  'operational data blocked',
  case
    when not public.is_claimed_user()
      and (select count(*) from public.departments) = 0
      and (select count(*) from public.employee_profiles) = 0
      and (select count(*) from public.shift_statuses) = 0
      and (select count(*) from public.rotation_versions) = 0
      and (select count(*) from public.schedule_overrides) = 0
      and (select count(*) from public.department_daily_leads) = 0
    then 'pass'
    else 'fail'
  end,
  'claimed=' || public.is_claimed_user()::text
    || ', profiles=' || (select count(*) from public.employee_profiles)::text
    || ', departments=' || (select count(*) from public.departments)::text
    || ', statuses=' || (select count(*) from public.shift_statuses)::text;

reset role;

select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);

select role_name, check_name, audit_status, details
from role_audit_results
order by
  case audit_status when 'fail' then 1 when 'skip' then 2 else 3 end,
  role_name,
  check_name;
