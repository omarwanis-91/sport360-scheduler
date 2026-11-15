select 'Holiday exception links to a specific batch' as check_name,
  exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'schedule_overrides' and column_name = 'holiday_override_batch_id' and data_type = 'uuid') as passed
union all
select 'Annual eligibility respects the matching holiday override',
  pg_get_functiondef('public.annual_eligible_dates(uuid,date,date)'::regprocedure)
    like '%holiday_override_batch_id is distinct from h.batch_id%'
union all
select 'Analytics excludes holidays overridden by a shift',
  pg_get_functiondef('public.calendar_holiday_rows(uuid[],integer)'::regprocedure)
    like '%holiday_override_batch_id = h.batch_id%'
union all
select 'Calendar exposes the holiday override capability',
  pg_get_functiondef('public.get_low_day_calendar()'::regprocedure) like '%holidayShiftOverridesEnabled%'
union all
select 'Holiday table stays private and holiday editing stays Admin guarded',
  not has_table_privilege('authenticated', 'public.public_holidays', 'SELECT,INSERT,UPDATE,DELETE')
  and pg_get_functiondef('public.save_scheduler_holiday(uuid,text,jsonb,boolean)'::regprocedure) like '%Only Admin%';
