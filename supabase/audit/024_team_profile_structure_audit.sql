select 'No people assigned to containers' check_name,not exists(
  select 1 from public.employee_profiles p join public.departments d on d.id=p.department_id where d.is_container
  union all select 1 from public.employee_profile_departments m join public.departments d on d.id=m.department_id where d.is_container) passed
union all select 'All titles derive from team and position',not exists(select 1 from public.employee_profiles p
  where p.title is distinct from public.derived_profile_title(p.id,p.seniority_level,p.department_id))
union all select 'Container and title guards installed',(select count(*)=4 from pg_trigger
  where not tgisinternal and tgname in ('profile_team_and_title','profile_membership_team','profile_membership_title','department_container'))
union all select 'Structure RPC grants protected',has_function_privilege('authenticated','public.save_managed_profile_structure(uuid,text,uuid[],text,text)','execute')
  and not has_function_privilege('anon','public.save_managed_profile_structure(uuid,text,uuid[],text,text)','execute')
  and not has_function_privilege('authenticated','public.lock_profile_structure(uuid)','execute')
union all select 'Manager requires Lead access and Manager position',
  pg_get_functiondef('public.current_user_is_team_manager()'::regprocedure) like '%current_role()%''lead''%'
  and pg_get_functiondef('public.current_user_is_team_manager()'::regprocedure) like '%seniority_level%''manager''%';
