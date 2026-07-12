-- Read-only audit for Admin-managed profile updates.

with checks as (
  select
    'function'::text as audit_area,
    'update_admin_profile'::text as check_name,
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'update_admin_profile'
        and procedure.pronargs = 12
    ) then 'pass' else 'fail' end as audit_status,
    'Admin profile update RPC'::text as details

  union all

  select
    'grant',
    'update_admin_profile authenticated execute',
    case when has_function_privilege(
      'authenticated',
      'public.update_admin_profile(uuid, text, text, text, text, text, boolean, uuid, text, integer, integer, uuid)',
      'execute'
    ) then 'pass' else 'fail' end,
    'browser role can call authorized RPC'

  union all

  select
    'column',
    'employee_profiles.seniority_level',
    case when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employee_profiles'
        and column_name = 'seniority_level'
    ) then 'pass' else 'fail' end,
    'required for hierarchy levels'

  union all

  select
    'column',
    'employee_profiles.is_department_lead',
    case when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employee_profiles'
        and column_name = 'is_department_lead'
    ) then 'pass' else 'fail' end,
    'required for lead eligibility'
)
select audit_area, check_name, audit_status, details
from checks
order by case audit_status when 'fail' then 1 else 2 end, audit_area, check_name;
