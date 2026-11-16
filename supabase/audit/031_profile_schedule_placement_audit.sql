select 'Schedule placements are private and separate from memberships' as check_name,
  to_regclass('public.profile_schedule_placements') is not null
  and not has_table_privilege('authenticated', 'public.profile_schedule_placements', 'SELECT,INSERT,UPDATE,DELETE')
  and (select relrowsecurity from pg_class where oid = 'public.profile_schedule_placements'::regclass) as passed
union all
select 'Reads scope both the person and the selected department',
  pg_get_functiondef('public.get_profile_schedule_placements()'::regprocedure) like '%current_user_can_read_profile%'
  and pg_get_functiondef('public.get_profile_schedule_placements()'::regprocedure) like '%current_user_can_access_department%'
  and not has_function_privilege('anon', 'public.get_profile_schedule_placements()', 'EXECUTE')
union all
select 'The private writer requires full team scope and validates the chosen membership',
  pg_get_functiondef('public.write_profile_schedule_placement(uuid,uuid)'::regprocedure) like '%current_user_can_edit_profile_position%'
  and pg_get_functiondef('public.write_profile_schedule_placement(uuid,uuid)'::regprocedure) like '%cardinality(teams) < 2%'
  and not has_function_privilege('authenticated', 'public.write_profile_schedule_placement(uuid,uuid)', 'EXECUTE')
union all
select 'Profile updates reuse the guarded Annual and team structure functions',
  pg_get_functiondef('public.save_admin_profile_with_schedule_placement(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer,uuid)'::regprocedure) like '%public.save_admin_profile_annual(%'
  and pg_get_functiondef('public.save_managed_profile_with_schedule_placement(uuid,text,uuid[],text,text,uuid)'::regprocedure) like '%public.save_managed_profile_structure(%'
union all
select 'Membership cleanup checks the final state of the transaction',
  (select count(*) from pg_trigger where tginitdeferred and tgdeferrable and tgname in (
    'clear_schedule_placement_after_membership_change', 'clear_schedule_placement_after_anchor_change'
  )) = 2;
