-- Read-only; run after migration 033. All five rows must pass.
select 'Yearly balances use scoped read-only RLS' check_name,
  (select relrowsecurity from pg_class where oid='public.annual_balance_years'::regclass)
  and exists(select 1 from pg_policies where schemaname='public' and tablename='annual_balance_years'
    and cmd='SELECT' and qual like '%current_user_can_read_profile%')
  and not has_table_privilege('authenticated','public.annual_balance_years','INSERT,UPDATE,DELETE') passed
union all select 'Current balances match the current-year ledger',
  not exists(select 1 from public.employee_profiles p left join public.annual_balance_years b
    on b.profile_id=p.id and b.balance_year=p.annual_balance_year
    where p.annual_balance_year<>public.annual_current_year() or b.profile_id is null
      or p.yearly_vacation_days<>b.allowance_days or p.remaining_vacation_days<>b.remaining_days)
union all select 'Browser cannot force a reset or bypass approval',
  not has_function_privilege('authenticated','public.rollover_annual_balances()','execute')
  and not has_function_privilege('authenticated','public.ensure_annual_balance_year(uuid,integer)','execute')
  and not has_function_privilege('authenticated','public.apply_vacation_overrides(uuid,date,date,uuid)','execute')
  and not has_function_privilege('anon','public.refresh_annual_balances()','execute')
  and has_function_privilege('authenticated','public.refresh_annual_balances()','execute')
  and has_function_privilege('authenticated','public.save_admin_profile_annual(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer)','execute')
  and not has_function_privilege('anon','public.save_admin_profile_annual(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer)','execute')
union all select 'Approvals split years and profile edits check stale balances',
  pg_get_functiondef('public.decide_vacation_request(uuid,public.vacation_status)'::regprocedure) like '%deducted_days_by_year=charges%'
  and pg_get_functiondef('public.decide_vacation_request(uuid,public.vacation_status)'::regprocedure) like '%Insufficient Annual balance for%'
  and pg_get_functiondef('public.save_admin_profile_annual(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer)'::regprocedure) like '%p_expected_remaining is distinct from p.remaining_vacation_days%'
  and exists(select 1 from pg_trigger where tgrelid='public.employee_profiles'::regclass and tgname='guard_annual_profile_balance' and not tgisinternal)
union all select 'Cairo rollover job is active',
  pg_get_functiondef('public.annual_current_year()'::regprocedure) like '%Africa/Cairo%'
  and exists(select 1 from cron.job where jobname='sport360-annual-year-rollover' and active
    and schedule='0 * * * *' and command='select public.rollover_annual_balances();');
