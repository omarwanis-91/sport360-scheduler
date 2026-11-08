with definition as (
  select pg_get_functiondef('public.save_rotation_drafts(uuid,jsonb)'::regprocedure) body
)
select 'Scoped atomic page save' check_name,
  body like '%current_user_can_manage_department%' and body like '%public.save_person_rotation(%'
    and body like '%order by profile.id for update%' passed from definition
union all select 'Unambiguous weekday Lead choices', body like '%Only one person can be Lead%' from definition
union all select 'Admin date correction guards', body like '%Only Admin can correct saved version dates%'
  and body like '%sourcePattern%' and body like '%A rotation already exists on that date%' from definition
union all select 'Reset remains explicit and Admin guarded', body like '%action_name = ''reset''%'
  and body like '%public.reset_person_rotation(target_id)%' from definition
union all select 'Authenticated RPC grants',
  has_function_privilege('authenticated', 'public.save_rotation_drafts(uuid,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.save_rotation_drafts(uuid,jsonb)', 'execute');
