-- Read-only audit for equal department membership lead assignment.

with checks as (
  select
    'function'::text as audit_area,
    'profile_belongs_to_department'::text as check_name,
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'profile_belongs_to_department'
        and procedure.pronargs = 2
    ) then 'pass' else 'fail' end as audit_status,
    'membership helper for equal department assignments'::text as details

  union all

  select
    'function',
    'validate_department_lead_rotation',
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'validate_department_lead_rotation'
    ) then 'pass' else 'fail' end,
    'weekly lead validation present'

  union all

  select
    'function',
    'validate_department_daily_lead',
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'validate_department_daily_lead'
    ) then 'pass' else 'fail' end,
    'daily lead validation present'

  union all

  select
    'function',
    'save_department_rotation_versions',
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'save_department_rotation_versions'
        and procedure.pronargs = 3
    ) then 'pass' else 'fail' end,
    'department rotation save RPC present'
)
select audit_area, check_name, audit_status, details
from checks
order by case audit_status when 'fail' then 1 else 2 end, audit_area, check_name;
