-- Read-only audit for department parent/sub-department structure.

with audit_checks as (
  select
    'column'::text as audit_area,
    'departments.parent_department_id'::text as check_name,
    case when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'departments'
        and column_name = 'parent_department_id'
    ) then 'pass' else 'fail' end as audit_status,
    'optional parent department for sub-departments'::text as details

  union all

  select
    'constraint',
    'departments parent not self',
    case when exists (
      select 1
      from pg_catalog.pg_constraint constraint_info
      join pg_catalog.pg_class class on class.oid = constraint_info.conrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'departments'
        and constraint_info.conname = 'departments_parent_not_self'
    ) then 'pass' else 'fail' end,
    'a department cannot be its own parent'
)
select audit_area, check_name, audit_status, details
from audit_checks
order by
  case audit_status when 'fail' then 1 else 2 end,
  audit_area,
  check_name;
