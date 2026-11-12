select 'Schedule events are private' as check_name,
  (select relrowsecurity from pg_class where oid = 'public.schedule_events'::regclass)
  and not has_table_privilege('authenticated', 'public.schedule_events', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.schedule_events', 'SELECT,INSERT,UPDATE,DELETE') as passed
union all
select 'Scheduler tools require authenticated access',
  bool_and(has_function_privilege('authenticated', signature, 'EXECUTE')
    and not has_function_privilege('anon', signature, 'EXECUTE'))
from unnest(array['public.get_scheduler_tools()', 'public.save_schedule_event(uuid,text,date,date,uuid[],boolean)']) r(signature)
union all
select 'Event writes enforce team scope and are audited',
  definition like '%can_manage_schedule_event(item.department_ids)%'
  and definition like '%can_manage_schedule_event(teams)%'
  and definition like '%team_is_assignable%'
  and definition like '%insert into public.audit_log%'
from (select pg_get_functiondef('public.save_schedule_event(uuid,text,date,date,uuid[],boolean)'::regprocedure) as definition) f
union all
select 'Event reads enforce team scope',
  pg_get_functiondef('public.get_scheduler_tools()'::regprocedure) like '%current_user_can_access_department(team.id)%'
  and not has_function_privilege('authenticated', 'public.can_manage_schedule_event(uuid[])', 'EXECUTE')
union all
select 'Manager preview lists only linked employees in shared teams',
  definition like '%current_user_is_team_manager()%'
  and definition like '%p.user_id is not null%'
  and definition like '%coalesce(r.role, ''employee'') = ''employee''%'
  and definition like '%cardinality(shared.ids) > 0%'
from (select pg_get_functiondef('public.get_scheduler_tools()'::regprocedure) as definition) f;
