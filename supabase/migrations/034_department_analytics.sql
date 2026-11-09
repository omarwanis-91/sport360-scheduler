-- Read-only, scoped analytics snapshot. Does not change schedules, roles or balances.
begin;
create or replace function public.get_schedule_analytics(
  p_year integer, p_department_id uuid default null, p_direct_only boolean default false
) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  viewer_role public.app_role := public.current_role();
  allowed_ids uuid[];
  profile_ids uuid[];
  first_day date;
  last_day date;
begin
  if auth.uid() is null or public.is_claimed_user() is not true or viewer_role is null or viewer_role not in ('admin','lead') then
    raise exception 'Analytics is available to Admin and Lead only.' using errcode='42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Choose a year between 2000 and 2100.' using errcode='22023';
  end if;
  first_day := make_date(p_year,1,1); last_day := make_date(p_year,12,31);
  if p_department_id is not null and not exists (
    select 1 from public.departments d where d.id=p_department_id
      and public.current_user_can_manage_department(d.id)
  ) then raise exception 'Department access denied.' using errcode='42501'; end if;

  if viewer_role='admin' and p_department_id is not null and not coalesce(p_direct_only,false) then
    with recursive scope(id) as (
      select p_department_id union
      select d.id from public.departments d join scope s on d.parent_department_id=s.id
    ) select coalesce(array_agg(id),'{}'::uuid[]) into allowed_ids from scope;
  else
    select coalesce(array_agg(d.id),'{}'::uuid[]) into allowed_ids
    from public.departments d where (p_department_id is null or d.id=p_department_id)
      and (viewer_role='admin' or public.profile_directly_belongs_to_department(public.current_profile_id(),d.id));
  end if;

  select coalesce(array_agg(p.id),'{}'::uuid[]) into profile_ids
  from public.employee_profiles p where (viewer_role='admin' and p_department_id is null)
    or exists (select 1 from unnest(allowed_ids) d(id) where public.profile_directly_belongs_to_department(p.id,d.id));

  return jsonb_build_object(
    'year',p_year,
    'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,
      'parentDepartmentId',case when d.parent_department_id=any(allowed_ids) then d.parent_department_id end) order by d.name)
      from public.departments d where d.id=any(allowed_ids)),'[]'::jsonb),
    'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,
      'departmentIds',(select coalesce(jsonb_agg(d.id),'[]'::jsonb) from unnest(allowed_ids) d(id)
        where public.profile_directly_belongs_to_department(p.id,d.id))) order by p.full_name,p.id)
      from public.employee_profiles p where p.id=any(profile_ids)),'[]'::jsonb),
    'statuses',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'kind',s.kind))
      from public.shift_statuses s),'[]'::jsonb),
    'rotationVersions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'profileId',r.profile_id,
      'effectiveStart',r.effective_start,'pattern',r.pattern)) from public.rotation_versions r
      where r.profile_id=any(profile_ids) and r.effective_start<=last_day
        and (r.effective_start>=first_day or r.effective_start=(select max(v.effective_start)
          from public.rotation_versions v where v.profile_id=r.profile_id and v.effective_start<first_day))),'[]'::jsonb),
    'scheduleOverrides',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'profileId',o.profile_id,
      'date',o.shift_date,'statusId',o.status_id)) from public.schedule_overrides o
      where o.profile_id=any(profile_ids) and o.shift_date between first_day and last_day),'[]'::jsonb),
    'departmentLeads',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'departmentId',l.department_id,
      'date',l.lead_date,'profileId',l.lead_profile_id)) from public.department_daily_leads l
      where l.department_id=any(allowed_ids) and l.lead_profile_id=any(profile_ids)
        and l.lead_date between first_day and last_day),'[]'::jsonb),
    'departmentLeadRotations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'departmentId',l.department_id,
      'effectiveStart',l.effective_start,'pattern',(select jsonb_agg(case when item.value in
        (select to_jsonb(p.id::text) from public.employee_profiles p where p.id=any(profile_ids))
        then item.value else '""'::jsonb end order by item.ord)
        from jsonb_array_elements(l.pattern) with ordinality item(value,ord))))
      from public.department_lead_rotation_versions l where l.department_id=any(allowed_ids) and l.effective_start<=last_day
        and (l.effective_start>=first_day or l.effective_start=(select max(v.effective_start)
          from public.department_lead_rotation_versions v where v.department_id=l.department_id and v.effective_start<first_day))),'[]'::jsonb),
    'vacationRequests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'profileId',r.profile_id,
      'startDate',r.start_date,'endDate',r.end_date,'status',r.status)) from public.vacation_requests r
      where r.profile_id=any(profile_ids) and r.start_date<=last_day and r.end_date>=first_day),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_schedule_analytics(integer,uuid,boolean) from public,anon;
grant execute on function public.get_schedule_analytics(integer,uuid,boolean) to authenticated;
commit;
