select 'Calendar and credit tables are private' as check_name,
  (select count(*) = 2 from pg_class
    where oid in ('public.public_holidays'::regclass, 'public.low_day_credits'::regclass) and relrowsecurity)
  and not has_table_privilege('authenticated', 'public.public_holidays', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.low_day_credits', 'SELECT,INSERT,UPDATE,DELETE') as passed
union all
select 'Calendar RPCs require authenticated access',
  bool_and(has_function_privilege('authenticated', signature, 'EXECUTE')
    and not has_function_privilege('anon', signature, 'EXECUTE'))
from unnest(array['public.get_low_day_calendar()', 'public.save_public_holiday(uuid,date,text,uuid[],boolean,boolean)',
  'public.confirm_low_day_work(uuid,date,text,text)', 'public.book_low_day(uuid,date)']) r(signature)
union all
select 'One earned and one booked credit per person and date',
  exists (select 1 from pg_constraint where conrelid = 'public.low_day_credits'::regclass and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (profile_id, worked_date)')
  and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'low_day_replacement_per_date')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'low_day_credits'
    and column_name = 'due_date' and generation_expression like '%worked_date + 30%')
union all
select 'Replacement days are protected schedule exceptions',
  exists (select 1 from public.shift_statuses where id = 'low_day' and kind = 'off')
  and exists (select 1 from pg_trigger where tgrelid = 'public.schedule_overrides'::regclass
    and tgname = 'guard_low_day_override' and tgenabled <> 'D')
union all
select 'Annual and Analytics use holiday-aware schedules',
  pg_get_functiondef('public.annual_eligible_dates(uuid,date,date)'::regprocedure) like '%public_holidays%'
  and pg_get_functiondef('public.annual_eligible_dates(uuid,date,date)'::regprocedure) like '%low_day%'
  and pg_get_functiondef('public.vacation_workday_count(uuid,date,date)'::regprocedure) like '%annual_eligible_dates%'
  and pg_get_functiondef('public.get_schedule_analytics(integer,uuid,boolean)'::regprocedure) like '%calendar_holiday_rows%'
  and not has_function_privilege('authenticated', 'public.get_schedule_analytics_base(integer,uuid,boolean)', 'EXECUTE');
