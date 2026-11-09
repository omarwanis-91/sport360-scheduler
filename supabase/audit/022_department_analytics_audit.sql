-- All five rows must pass. Behavior and role isolation are also covered by the isolated integration test.
select 'Analytics RPC installed' check_name,
  to_regprocedure('public.get_schedule_analytics(integer,uuid,boolean)') is not null passed
union all select 'Authenticated execute',has_function_privilege('authenticated','public.get_schedule_analytics(integer,uuid,boolean)','execute')
union all select 'Anonymous execute denied',not has_function_privilege('anon','public.get_schedule_analytics(integer,uuid,boolean)','execute')
union all select 'Read-only stable function',provolatile='s' from pg_proc where oid='public.get_schedule_analytics(integer,uuid,boolean)'::regprocedure
union all select 'Fixed search path and definer',prosecdef and 'search_path=public'=any(proconfig)
from pg_proc where oid='public.get_schedule_analytics(integer,uuid,boolean)'::regprocedure;
