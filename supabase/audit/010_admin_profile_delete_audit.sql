-- Read-only audit for Admin profile deletion support.

with checks as (
  select
    'function'::text as audit_area,
    'delete_admin_profile'::text as check_name,
    case when exists (
      select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'delete_admin_profile'
        and procedure.pronargs = 1
    ) then 'pass' else 'fail' end as audit_status,
    'Admin profile delete RPC'::text as details

  union all

  select
    'grant',
    'delete_admin_profile authenticated execute',
    case when has_function_privilege('authenticated', 'public.delete_admin_profile(uuid)', 'execute')
      then 'pass' else 'fail' end,
    'browser role can call authorized delete RPC'
)
select audit_area, check_name, audit_status, details
from checks
order by case audit_status when 'fail' then 1 else 2 end, audit_area, check_name;
