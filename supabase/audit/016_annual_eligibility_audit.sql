select
  'Annual count excludes protected days' as check_name,
  pg_get_functiondef('public.vacation_workday_count(uuid,date,date)'::regprocedure)
    ilike '%not in (''weekend'', ''sick'', ''vacation'')%' as passed,
  'Weekend, Sick, and existing Annual are excluded from deductions' as detail;

select
  'Annual overrides preserve protected days' as check_name,
  pg_get_functiondef('public.apply_vacation_overrides(uuid,date,date,uuid)'::regprocedure)
    ilike '%schedule_overrides.status_id not in (''weekend'', ''sick'', ''vacation'')%' as passed,
  'Approval cannot overwrite protected daily statuses' as detail;

select
  'Annual requests require eligible work' as check_name,
  exists (
    select 1
    from pg_trigger trigger
    where trigger.tgrelid = 'public.vacation_requests'::regclass
      and trigger.tgname = 'vacation_requests_require_eligible_day'
      and not trigger.tgisinternal
  ) as passed,
  'Zero-impact pending requests are rejected before insert or date edits' as detail;

select
  'Annual approval rechecks eligibility' as check_name,
  pg_get_functiondef('public.decide_vacation_request(uuid,public.vacation_status)'::regprocedure)
    ilike '%No eligible working days remain in this annual request%' as passed,
  'Approval re-evaluates the latest schedule and rejects zero-day overlap' as detail;
