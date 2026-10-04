-- Read-only audit for parent/sub-department lead validation.

with function_checks as (
  select
    'function'::text as audit_area,
    'validate_department_daily_lead uses department scope'::text as check_name,
    case when coalesce(pg_get_functiondef((
      select procedure.oid
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'validate_department_daily_lead'
      limit 1
    )), '') ilike '%profile_belongs_to_department%'
      then 'pass' else 'fail' end as audit_status,
    'daily lead validation accepts direct members and descendant-department members'::text as details

  union all

  select
    'function',
    'validate_department_lead_rotation uses department scope',
    case when coalesce(pg_get_functiondef((
      select procedure.oid
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'validate_department_lead_rotation'
      limit 1
    )), '') ilike '%profile_belongs_to_department%'
      then 'pass' else 'fail' end,
    'weekly lead validation accepts direct members and descendant-department members'

  union all

  select
    'function',
    'profile_belongs_to_department traverses descendants',
    case when coalesce(pg_get_functiondef((
      select procedure.oid
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'profile_belongs_to_department'
        and procedure.pronargs = 2
      limit 1
    )), '') ilike '%with recursive department_scope%'
      then 'pass' else 'fail' end,
    'parent departments include profiles assigned to child departments'
)
select audit_area, check_name, audit_status, details
from function_checks
order by
  case audit_status when 'fail' then 1 else 2 end,
  audit_area,
  check_name;
