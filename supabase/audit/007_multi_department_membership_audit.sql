-- Read-only audit for multi-department memberships and self-service title updates.

with checks as (
  select
    'table'::text as audit_area,
    'employee profile departments'::text as check_name,
    case when exists (
      select 1 from information_schema.tables
      where table_schema = 'public'
        and table_name = 'employee_profile_departments'
    ) then 'pass' else 'fail' end as audit_status,
    'profile-to-department memberships'::text as details

  union all

  select
    'rls',
    'employee profile departments',
    case when exists (
      select 1
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'employee_profile_departments'
        and class.relrowsecurity
    ) then 'pass' else 'fail' end,
    'row-level security enabled'

  union all

  select
    'function',
    'update own profile title',
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'update_own_profile'
        and procedure.pronargs = 4
    ) then 'pass' else 'fail' end,
    'four-argument owner update RPC'

  union all

  select
    'data',
    'primary departments mirrored',
    case when not exists (
      select 1
      from public.employee_profiles profile
      where profile.department_id is not null
        and not exists (
          select 1
          from public.employee_profile_departments membership
          where membership.profile_id = profile.id
            and membership.department_id = profile.department_id
        )
    ) then 'pass' else 'fail' end,
    'every primary department is also a membership'
)
select audit_area, check_name, audit_status, details
from checks
order by case audit_status when 'fail' then 1 else 2 end, audit_area, check_name;
