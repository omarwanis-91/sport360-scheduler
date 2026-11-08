select
  'Direct rotation save RPC exists' as check_name,
  to_regprocedure('public.apply_rotation_patterns(uuid,date,jsonb)') is not null as passed;

with definition as (
  select pg_get_functiondef('public.apply_rotation_patterns(uuid,date,jsonb)'::regprocedure) as body
)
select 'Direct rotation authorization' as check_name,
  body like '%is_claimed_user()%'
    and body like '%current_user_can_manage_department(p_department_id)%'
    and body like '%profile_directly_belongs_to_department(target_profile_id, p_department_id)%'
    and body like '%profile_belongs_to_department(target_profile_id, p_department_id)%' as passed
from definition
union all
select 'Direct rotation validation',
  body like '%exactly seven weekday slots%'
    and body like '%only rotational shifts%'
    and body like '%Each profile must appear exactly once%'
    and body like '%cannot change past rotation versions%'
from definition
union all
select 'Same-date update and stable locking',
  body like '%order by profile.id%'
    and body like '%for update%'
    and body like '%set pattern = pattern_value%'
    and body not ilike '%delete from%'
from definition;

select 'Direct rotation execute grants' as check_name,
  has_function_privilege('authenticated', 'public.apply_rotation_patterns(uuid,date,jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.apply_rotation_patterns(uuid,date,jsonb)', 'execute') as passed;
