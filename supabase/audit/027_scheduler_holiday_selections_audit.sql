select 'Selected holidays are private' as check_name,
  (select relrowsecurity from pg_class where oid = 'public.public_holidays'::regclass)
  and not has_table_privilege('authenticated', 'public.public_holidays', 'SELECT,INSERT,UPDATE,DELETE') as passed
union all
select 'Holiday selection RPC is authenticated and Admin guarded',
  has_function_privilege('authenticated', signature, 'EXECUTE')
  and not has_function_privilege('anon', signature, 'EXECUTE')
  and pg_get_functiondef(signature::regprocedure) like '%Only Admin%'
from (values ('public.save_scheduler_holiday(uuid,text,jsonb,boolean)')) r(signature)
union all
select 'Calendar and Annual eligibility use person-level assignments',
  pg_get_functiondef('public.calendar_holiday_rows(uuid[],integer)'::regprocedure) like '%holiday_applies%'
  and pg_get_functiondef('public.annual_eligible_dates(uuid,date,date)'::regprocedure) like '%holiday_applies%'
  and pg_get_functiondef('public.book_low_day(uuid,date)'::regprocedure) like '%holiday_applies%'
union all
select 'Worked leave calls the private Annual refund in the credit transaction',
  pg_get_functiondef('public.confirm_low_day_work(uuid,date,text,text)'::regprocedure) like '%refund_worked_annual%'
  and not has_function_privilege('authenticated', 'public.refund_worked_annual(uuid,date,text)', 'EXECUTE')
  and exists (select 1 from pg_constraint where conrelid = 'public.low_day_credits'::regclass
    and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (profile_id, worked_date)')
union all
select 'Holiday batch schema and calendar capability are available',
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'public_holidays_batch_date')
  and pg_get_functiondef('public.get_low_day_calendar()'::regprocedure) like '%holidaySelectionEnabled%';
