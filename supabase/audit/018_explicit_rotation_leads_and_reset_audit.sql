with definitions as (
  select
    pg_get_functiondef('public.save_person_rotation(uuid,uuid,date,text[],boolean[])'::regprocedure) as save_body,
    pg_get_functiondef('public.reset_person_rotation(uuid)'::regprocedure) as reset_body,
    pg_get_functiondef('public.validate_department_lead_rotation()'::regprocedure) as validation_body
)
select 'Unassigned lead slots allowed' as check_name,
  validation_body like '%slot is null or slot = ''''%'
    and validation_body like '%profile_directly_belongs_to_department%' as passed
from definitions
union all
select 'Person save is atomic and scoped',
  save_body like '%public.apply_rotation_patterns(%'
    and save_body like '%current_user_can_manage_department%'
    and save_body like '%for update%'
    and save_body like '%p_lead_days[day_index]%'
from definitions
union all
select 'Admin-only full rotation reset',
  reset_body like '%current_role() is distinct from ''admin''%'
    and reset_body like '%delete from public.rotation_versions where profile_id = p_profile_id%'
    and reset_body like '%lead.pattern ? p_profile_id::text%'
from definitions
union all
select 'Reset preserves unrelated data and logs action',
  reset_body like '%rotation.reset%'
    and reset_body not ilike '%delete from public.employee_profiles%'
    and reset_body not ilike '%delete from public.schedule_overrides%'
    and reset_body not ilike '%delete from public.vacation_requests%'
from definitions
union all
select 'RPC execute grants',
  has_function_privilege('authenticated', 'public.save_person_rotation(uuid,uuid,date,text[],boolean[])', 'execute')
    and has_function_privilege('authenticated', 'public.reset_person_rotation(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.save_person_rotation(uuid,uuid,date,text[],boolean[])', 'execute')
    and not has_function_privilege('anon', 'public.reset_person_rotation(uuid)', 'execute');
