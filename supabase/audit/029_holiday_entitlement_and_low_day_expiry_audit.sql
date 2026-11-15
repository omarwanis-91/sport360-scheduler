select 'Low Days expiry is stored per credit' as check_name,
  exists (select 1 from public.low_day_settings where singleton and expiry_days between 1 and 365)
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'low_day_credits'
    and column_name = 'due_date' and generation_expression like '%worked_date + expiry_days%') as passed
union all
select 'Holiday entitlements and Low Days settings stay private',
  not has_table_privilege('authenticated', 'public.holiday_entitlements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.low_day_settings', 'SELECT,INSERT,UPDATE,DELETE')
union all
select 'Worked shifts and holiday shortfalls have separate unique keys',
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
    'low_day_one_credit_per_worked_shift', 'low_day_one_credit_per_holiday_day_owed')) = 2
  and pg_get_functiondef('public.annual_eligible_dates(uuid,date,date)'::regprocedure) like '%holiday_batch_id is null%'
union all
select 'Entitlement and expiry writes are Admin guarded',
  pg_get_functiondef('public.save_entitled_scheduler_holiday(uuid,text,jsonb,boolean,integer,uuid[])'::regprocedure) like '%Only Admin%'
  and pg_get_functiondef('public.save_low_day_expiry(integer)'::regprocedure) like '%Only Admin%'
  and not has_function_privilege('authenticated', 'public.save_scheduler_holiday_base(uuid,text,jsonb,boolean,uuid)', 'EXECUTE')
union all
select 'Worked shift clearing protects bookings and restores applicable Annual',
  pg_get_functiondef('public.clear_low_day_work(uuid,date)'::regprocedure) like '%replacement_date is not null%'
  and pg_get_functiondef('public.clear_low_day_work(uuid,date)'::regprocedure) like '%annual_balance_years%'
  and not has_function_privilege('anon', 'public.clear_low_day_work(uuid,date)', 'EXECUTE');
