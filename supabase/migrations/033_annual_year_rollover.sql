-- Apply before deploying the matching client. Existing balances are imported unchanged.
begin;

create or replace function public.annual_current_year()
returns integer language sql stable set search_path = public
as $$ select extract(year from now() at time zone 'Africa/Cairo')::integer $$;
revoke all on function public.annual_current_year() from public, anon;
grant execute on function public.annual_current_year() to authenticated, service_role;

alter table public.employee_profiles
  add column if not exists annual_balance_year integer not null default public.annual_current_year();
create index if not exists employee_profiles_annual_balance_year on public.employee_profiles(annual_balance_year);

create table if not exists public.annual_balance_years (
  profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  balance_year integer not null check (balance_year between 1900 and 9999),
  allowance_days integer not null check (allowance_days >= 0),
  remaining_days integer not null check (remaining_days >= 0),
  source text not null check (source in ('opening', 'renewal', 'advance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, balance_year)
);
alter table public.annual_balance_years enable row level security;
revoke all on public.annual_balance_years from public, anon, authenticated;
grant select on public.annual_balance_years to authenticated;
create policy "annual balances follow profile visibility" on public.annual_balance_years
for select to authenticated using (public.current_user_can_read_profile(profile_id));

insert into public.annual_balance_years(profile_id,balance_year,allowance_days,remaining_days,source)
select id,annual_balance_year,yearly_vacation_days,remaining_vacation_days,'opening'
from public.employee_profiles on conflict do nothing;

alter table public.vacation_requests add column if not exists deducted_days_by_year jsonb not null default '{}'::jsonb;

-- Future leave approved by an older client already has dated Annual overrides.
-- Reserve those dates in their actual year without refunding/rewriting today's manual balance.
-- BEGIN LEGACY PREFLIGHT
do $$
begin
  if exists(select 1 from public.schedule_overrides o join public.employee_profiles p on p.id=o.profile_id
    where o.status_id='vacation' and extract(year from o.shift_date)>p.annual_balance_year
      and not exists(select 1 from public.vacation_requests r where r.profile_id=p.id
        and r.status='approved' and o.note='Vacation request '||r.id::text)) then
    raise exception 'Future Annual dates lack an approved request. Review those records before applying migration 033';
  end if;
  if exists(select 1 from public.employee_profiles p join public.schedule_overrides o on o.profile_id=p.id
    where o.status_id='vacation' and extract(year from o.shift_date)>p.annual_balance_year
    group by p.id,extract(year from o.shift_date) having count(*)>p.yearly_vacation_days) then
    raise exception 'Already approved future Annual exceeds the saved allowance. Review those bookings before migration 033';
  end if;
end;
$$;
-- END LEGACY PREFLIGHT
insert into public.annual_balance_years(profile_id,balance_year,allowance_days,remaining_days,source)
select p.id,extract(year from o.shift_date)::integer,p.yearly_vacation_days,
       p.yearly_vacation_days-count(*)::integer,'advance'
from public.employee_profiles p join public.schedule_overrides o on o.profile_id=p.id
join public.vacation_requests r on r.profile_id=p.id and r.status='approved'
  and o.note='Vacation request ' || r.id::text
where o.status_id='vacation' and extract(year from o.shift_date)>p.annual_balance_year
group by p.id,extract(year from o.shift_date)
on conflict do nothing;
-- A negative result intentionally fails the transaction: review overbooked legacy future leave first.

create or replace function public.annual_eligible_dates(p_profile_id uuid,p_start date,p_end date)
returns table(shift_date date) language sql stable security definer set search_path=public
as $$
  select d.day::date from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d(day)
  left join public.schedule_overrides o on o.profile_id=p_profile_id and o.shift_date=d.day::date
  left join lateral (
    select r.* from public.rotation_versions r where r.profile_id=p_profile_id and r.effective_start<=d.day::date
    order by r.effective_start desc limit 1
  ) r on true
  join public.shift_statuses s on s.id=coalesce(o.status_id,
    case when array_length(r.pattern,1)=7 then r.pattern[extract(isodow from d.day)::integer]
    else r.pattern[((d.day::date-r.effective_start)%array_length(r.pattern,1))+1] end)
  where s.kind='working' and s.id not in ('weekend','sick','vacation')
$$;

-- Private helpers always lock the person before a year's balance: approvals, edits and cron serialize.
create or replace function public.ensure_annual_balance_year(p_profile_id uuid,p_year integer)
returns public.annual_balance_years language plpgsql security definer set search_path=public
as $$
declare p public.employee_profiles; b public.annual_balance_years;
begin
  select * into strict p from public.employee_profiles where id=p_profile_id for update;
  if p_year < (select min(balance_year) from public.annual_balance_years where profile_id=p.id) then
    raise exception 'Annual balance history for this year is not available; ask Admin to review it';
  end if;
  insert into public.annual_balance_years(profile_id,balance_year,allowance_days,remaining_days,source)
  values(p.id,p_year,p.yearly_vacation_days,p.yearly_vacation_days,'advance') on conflict do nothing;
  select * into strict b from public.annual_balance_years where profile_id=p.id and balance_year=p_year for update;
  return b;
end;
$$;

create or replace function public.rollover_profile_annual_balance(p_profile_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare p public.employee_profiles; b public.annual_balance_years; y integer; target_year integer:=public.annual_current_year();
  prior_action text:=current_setting('sport360.annual_action',true);
begin
  select * into strict p from public.employee_profiles where id=p_profile_id for update;
  if p.annual_balance_year>=target_year then return; end if;
  perform set_config('sport360.annual_action','renewal',true);
  for y in p.annual_balance_year+1..target_year loop
    b:=public.ensure_annual_balance_year(p.id,y);
    update public.annual_balance_years set source='renewal',updated_at=now()
    where profile_id=p.id and balance_year=y;
    insert into public.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(null,'annual.year_renewed','profile',p.id::text,
      jsonb_build_object('year',y,'allowance',b.allowance_days,'remaining',b.remaining_days,'timezone','Africa/Cairo',
        'message',format('%s Annual renewed: %s/%s days available',y,b.remaining_days,b.allowance_days)));
  end loop;
  update public.employee_profiles set annual_balance_year=target_year,
    remaining_vacation_days=b.remaining_days,updated_at=now() where id=p.id;
  perform set_config('sport360.annual_action',coalesce(prior_action,''),true);
end;
$$;

create or replace function public.rollover_annual_balances()
returns integer language plpgsql security definer set search_path=public
as $$
declare person record; changed integer:=0;
begin
  for person in select id from public.employee_profiles
    where annual_balance_year<public.annual_current_year() order by id loop
    perform public.rollover_profile_annual_balance(person.id); changed:=changed+1;
  end loop;
  return changed;
end;
$$;

create or replace function public.refresh_annual_balances()
returns void language plpgsql security definer set search_path=public
as $$
declare person record;
begin
  if auth.uid() is null or not public.is_claimed_user() then raise exception 'Authentication required'; end if;
  for person in select id from public.employee_profiles where annual_balance_year<public.annual_current_year()
    and public.current_user_can_read_profile(id) order by id loop
    perform public.rollover_profile_annual_balance(person.id);
  end loop;
end;
$$;

create or replace function public.guard_annual_profile_balance()
returns trigger language plpgsql security definer set search_path=public
as $$
declare action text:=coalesce(current_setting('sport360.annual_action',true),'');
begin
  if tg_op='INSERT' then new.annual_balance_year:=public.annual_current_year(); return new; end if;
  if new.annual_balance_year is distinct from old.annual_balance_year and action<>'renewal' then
    raise exception 'Balance year is managed automatically';
  end if;
  if new.yearly_vacation_days is distinct from old.yearly_vacation_days
    or new.remaining_vacation_days is distinct from old.remaining_vacation_days then
    if action not in ('renewal','approval') then
      if old.annual_balance_year<>public.annual_current_year() then
        raise exception 'Annual balance year changed. Refresh before editing';
      end if;
      if auth.uid() is not null and (
        public.current_role()<>'admin' or
        coalesce(current_setting('sport360.annual_edit_year',true),'')<>old.annual_balance_year::text
      ) then raise exception 'Refresh the updated app before changing Annual balances'; end if;
    end if;
    if exists(select 1 from public.annual_balance_years b where b.profile_id=old.id
      and b.balance_year>new.annual_balance_year and b.allowance_days-b.remaining_days>new.yearly_vacation_days) then
      raise exception 'Allowance cannot be lower than already approved future-year Annual';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_annual_profile_balance()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.annual_balance_years(profile_id,balance_year,allowance_days,remaining_days,source)
  values(new.id,new.annual_balance_year,new.yearly_vacation_days,new.remaining_vacation_days,'opening')
  on conflict(profile_id,balance_year) do update set allowance_days=excluded.allowance_days,
    remaining_days=excluded.remaining_days,updated_at=now();
  update public.annual_balance_years set remaining_days=remaining_days+new.yearly_vacation_days-allowance_days,
    allowance_days=new.yearly_vacation_days,updated_at=now()
  where profile_id=new.id and balance_year>new.annual_balance_year and allowance_days<>new.yearly_vacation_days;
  if tg_op='UPDATE' and coalesce(current_setting('sport360.annual_action',true),'') not in ('renewal','approval')
    and (old.yearly_vacation_days is distinct from new.yearly_vacation_days
      or old.remaining_vacation_days is distinct from new.remaining_vacation_days) then
    insert into public.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'annual.balance_adjusted','profile',new.id::text,jsonb_build_object(
      'year',new.annual_balance_year,'previous_allowance',old.yearly_vacation_days,
      'allowance',new.yearly_vacation_days,'previous_remaining',old.remaining_vacation_days,'remaining',new.remaining_vacation_days,
      'message',format('%s Annual balance: %s/%s to %s/%s days left',new.annual_balance_year,
        old.remaining_vacation_days,old.yearly_vacation_days,new.remaining_vacation_days,new.yearly_vacation_days)));
  end if;
  return new;
end;
$$;
create trigger guard_annual_profile_balance before insert or update of annual_balance_year,yearly_vacation_days,remaining_vacation_days
on public.employee_profiles for each row execute function public.guard_annual_profile_balance();
create trigger sync_annual_profile_balance after insert or update of annual_balance_year,yearly_vacation_days,remaining_vacation_days
on public.employee_profiles for each row execute function public.sync_annual_profile_balance();

create or replace function public.save_admin_profile_annual(
  p_profile_id uuid,p_employee_code text,p_email text,p_full_name text,p_title text,p_seniority_level text,
  p_department_ids uuid[],p_photo_url text,p_yearly_vacation_days integer,p_remaining_vacation_days integer,p_user_id uuid,
  p_expected_balance_year integer,p_expected_allowance integer,p_expected_remaining integer
)
returns public.employee_profiles language plpgsql security definer set search_path=public
as $$
declare p public.employee_profiles; result public.employee_profiles;
  prior_edit text:=current_setting('sport360.annual_edit_year',true);
begin
  if auth.uid() is null or public.current_role()<>'admin' then raise exception 'Only Admins can update employee profiles'; end if;
  perform public.rollover_profile_annual_balance(p_profile_id);
  select * into strict p from public.employee_profiles where id=p_profile_id for update;
  if p_expected_balance_year is distinct from p.annual_balance_year
    or p_expected_allowance is distinct from p.yearly_vacation_days
    or p_expected_remaining is distinct from p.remaining_vacation_days then
    raise exception 'Annual balance changed. Refresh before editing so approved leave is preserved';
  end if;
  if p_yearly_vacation_days is null or p_remaining_vacation_days is null
    or p_yearly_vacation_days<0 or p_remaining_vacation_days<0 then raise exception 'Annual balances must be non-negative'; end if;
  perform set_config('sport360.annual_edit_year',p.annual_balance_year::text,true);
  result:=public.save_admin_profile(p_profile_id,p_employee_code,p_email,p_full_name,p_title,p_seniority_level,
    p_department_ids,p_photo_url,p_yearly_vacation_days,p_remaining_vacation_days,p_user_id);
  perform set_config('sport360.annual_edit_year',coalesce(prior_edit,''),true);
  return result;
end;
$$;

create or replace function public.decide_vacation_request(p_request_id uuid,p_decision public.vacation_status)
returns public.vacation_requests language plpgsql security definer set search_path=public
as $$
declare r public.vacation_requests; p public.employee_profiles; b public.annual_balance_years;
  part record; dates date[]; charges jsonb:='{}'; result public.vacation_requests;
  prior_action text:=current_setting('sport360.annual_action',true);
begin
  if auth.uid() is null or not public.is_claimed_user() then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into strict r from public.vacation_requests where id=p_request_id for update;
  if r.status<>'pending' then raise exception 'Only pending vacation requests can be decided'; end if;
  select * into strict p from public.employee_profiles where id=r.profile_id for update;
  if not (public.current_role()='admin' or (public.current_role()='lead' and public.current_user_can_manage_profile(p.id))) then
    raise exception 'Not allowed to decide this vacation request';
  end if;
  if p_decision='approved' then
    perform public.rollover_profile_annual_balance(p.id);
    select array_agg(shift_date order by shift_date) into dates from public.annual_eligible_dates(p.id,r.start_date,r.end_date);
    if coalesce(cardinality(dates),0)=0 then raise exception 'No eligible working days remain in this annual request'; end if;
    for part in select extract(year from day)::integer y,count(*)::integer days from unnest(dates) day group by 1 order by 1 loop
      b:=public.ensure_annual_balance_year(p.id,part.y);
      if b.remaining_days<part.days then raise exception 'Insufficient Annual balance for %',part.y; end if;
      update public.annual_balance_years set remaining_days=remaining_days-part.days,updated_at=now()
      where profile_id=p.id and balance_year=part.y;
      charges:=charges || jsonb_build_object(part.y::text,part.days);
    end loop;
    perform set_config('sport360.annual_action','approval',true);
    update public.employee_profiles set remaining_vacation_days=ledger.remaining_days,updated_at=now()
    from public.annual_balance_years ledger where employee_profiles.id=p.id
      and ledger.profile_id=p.id and ledger.balance_year=employee_profiles.annual_balance_year;
    perform set_config('sport360.annual_action',coalesce(prior_action,''),true);
    insert into public.schedule_overrides(profile_id,shift_date,status_id,note,created_by)
    select p.id,day,'vacation','Vacation request '||r.id::text,auth.uid() from unnest(dates) day
    on conflict(profile_id,shift_date) do update set status_id=excluded.status_id,note=excluded.note,updated_at=now()
    where schedule_overrides.status_id not in ('weekend','sick','vacation');
  end if;
  update public.vacation_requests set status=p_decision,decided_by=auth.uid(),decided_at=now(),
    deducted_days=case when p_decision='approved' then cardinality(dates) else 0 end,
    deducted_days_by_year=charges where id=r.id returning * into result;
  return result;
end;
$$;

revoke all on function public.annual_eligible_dates(uuid,date,date),public.ensure_annual_balance_year(uuid,integer),
  public.rollover_profile_annual_balance(uuid),public.rollover_annual_balances(),public.guard_annual_profile_balance(),
  public.sync_annual_profile_balance(),public.refresh_annual_balances(),
  public.save_admin_profile_annual(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer),
  public.decide_vacation_request(uuid,public.vacation_status) from public,anon,authenticated;
grant execute on function public.refresh_annual_balances(),
  public.save_admin_profile_annual(uuid,text,text,text,text,text,uuid[],text,integer,integer,uuid,integer,integer,integer),
  public.decide_vacation_request(uuid,public.vacation_status) to authenticated;
grant execute on function public.rollover_annual_balances() to service_role;
revoke all on function public.apply_vacation_overrides(uuid,date,date,uuid) from public,anon,authenticated;

-- BEGIN CRON INSTALL: exercised by the live audit; PGlite tests exercise the core above.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('sport360-annual-year-rollover','0 * * * *','select public.rollover_annual_balances();');
-- END CRON INSTALL
select pg_notify('pgrst','reload schema');
commit;
