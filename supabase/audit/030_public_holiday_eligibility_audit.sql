with definitions as (
  select pg_get_functiondef('public.save_scheduler_holiday_base(uuid,text,jsonb,boolean,uuid)'::regprocedure) as base,
    pg_get_functiondef('public.save_entitled_scheduler_holiday(uuid,text,jsonb,boolean,integer,uuid[])'::regprocedure) as entitled,
    pg_get_functiondef('public.save_scheduler_holiday(uuid,text,jsonb,boolean)'::regprocedure) as legacy
)
select 'Holiday eligibility checks the effective daily override or rotation' as check_name,
  base like '%coalesce(o.status_id, public.rotation_status_on(cell.profile_id, cell.day)) in (''weekend'', ''vacation'', ''sick'')%' as passed
from definitions
union all
select 'Existing allocations can be kept when editing a batch',
  base like '%saved.batch_id = p_batch%' and base like '%cell.profile_id = any(saved.selected_profiles)%'
from definitions
union all
select 'Eligibility runs after locking the affected profiles and before replacing the batch',
  strpos(base, 'order by p.id for update') > 0
  and strpos(base, 'order by p.id for update') < strpos(base, 'A selected shift is Weekend')
  and strpos(base, 'A selected shift is Weekend') < strpos(base, 'delete from public.public_holidays')
from definitions
union all
select 'Both holiday selection RPCs enforce the guard',
  entitled like '%public.save_scheduler_holiday_base(%' and legacy like '%public.save_entitled_scheduler_holiday(%'
from definitions
union all
select 'The shared save remains private and Admin guarded',
  base like '%Only Admin can manage public holidays%'
  and not has_function_privilege('authenticated', 'public.save_scheduler_holiday_base(uuid,text,jsonb,boolean,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.save_scheduler_holiday_base(uuid,text,jsonb,boolean,uuid)', 'EXECUTE')
from definitions;
