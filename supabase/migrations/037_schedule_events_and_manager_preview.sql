begin;

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 100),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  department_ids uuid[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedule_events enable row level security;
revoke all on public.schedule_events from public, anon, authenticated;
create index schedule_events_start_date on public.schedule_events(starts_on, ends_on);

create function public.can_manage_schedule_event(p_departments uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin' or (
    public.current_role() = 'lead' and cardinality(p_departments) > 0
    and not exists (
      select 1 from unnest(p_departments) team(id)
      where not public.current_user_can_manage_department(team.id)
    )
  )
$$;

create function public.get_scheduler_tools()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  preview_profiles jsonb;
begin
  if auth.uid() is null or public.is_claimed_user() is not true then
    raise exception 'Profile access required.' using errcode = '42501';
  end if;

  if public.current_user_is_team_manager() then
    select coalesce(jsonb_agg(jsonb_build_object('profileId', p.id, 'departmentIds', shared.ids)
      order by p.full_name, p.id), '[]'::jsonb)
    into preview_profiles
    from public.employee_profiles p
    left join public.user_roles r on r.user_id = p.user_id
    cross join lateral (
      select array(select id from unnest(public.profile_team_ids(p.id)) team(id)
        where id = any(public.profile_team_ids(public.current_profile_id()))) as ids
    ) shared
    where p.user_id is not null and coalesce(r.role, 'employee') = 'employee' and cardinality(shared.ids) > 0;
  end if;

  return jsonb_build_object('previewProfiles', preview_profiles, 'events', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'startsOn', e.starts_on, 'endsOn', e.ends_on,
      'organizationWide', cardinality(e.department_ids) = 0,
      'departmentIds', array(select id from unnest(e.department_ids) team(id)
        where public.current_user_can_access_department(team.id)),
      'editable', public.can_manage_schedule_event(e.department_ids)
    ) order by e.starts_on, e.title, e.id)
    from public.schedule_events e
    where public.current_role() = 'admin' or cardinality(e.department_ids) = 0
      or exists (select 1 from unnest(e.department_ids) team(id)
        where public.current_user_can_access_department(team.id))
  ), '[]'::jsonb));
end;
$$;

create function public.save_schedule_event(
  p_id uuid, p_title text, p_start date, p_end date, p_department_ids uuid[], p_delete boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item public.schedule_events;
  teams uuid[] := coalesce(p_department_ids, '{}');
begin
  if auth.uid() is null or public.is_claimed_user() is not true or public.current_role() not in ('admin', 'lead') then
    raise exception 'Only Admin and Lead can manage events.' using errcode = '42501';
  end if;

  perform public.lock_profile_structure(public.current_profile_id());
  if p_id is not null then
    select * into item from public.schedule_events where id = p_id for update;
    if not found or public.can_manage_schedule_event(item.department_ids) is not true then
      raise exception 'You can only manage events within your teams.' using errcode = '42501';
    end if;
  end if;

  if p_delete then
    if p_id is null then raise exception 'Choose an event to remove.'; end if;
    delete from public.schedule_events where id = p_id;
  else
    if coalesce(length(trim(p_title)), 0) not between 1 and 100
      or p_start is null or p_end is null or p_end < p_start then
      raise exception 'Enter a name and a valid date range.';
    end if;
    if exists (select 1 from unnest(teams) team(id) where id is null or not public.team_is_assignable(id)) then
      raise exception 'Choose valid teams.';
    end if;
    if public.can_manage_schedule_event(teams) is not true then
      raise exception 'Choose only teams you manage.' using errcode = '42501';
    end if;

    if p_id is null then
      insert into public.schedule_events (title, starts_on, ends_on, department_ids, created_by)
      values (trim(p_title), p_start, p_end, teams, auth.uid()) returning * into item;
    else
      update public.schedule_events set title = trim(p_title), starts_on = p_start,
        ends_on = p_end, department_ids = teams, updated_at = now()
      where id = p_id returning * into item;
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), case when p_delete then 'event.deleted' else 'event.saved' end, 'schedule_event', item.id::text,
    jsonb_build_object('message', item.title || ' · ' || item.starts_on || ' to ' || item.ends_on));
  return public.get_scheduler_tools();
end;
$$;

revoke all on function public.can_manage_schedule_event(uuid[]) from public, anon, authenticated;
revoke all on function public.get_scheduler_tools(), public.save_schedule_event(uuid,text,date,date,uuid[],boolean)
  from public, anon;
grant execute on function public.get_scheduler_tools(), public.save_schedule_event(uuid,text,date,date,uuid[],boolean)
  to authenticated;

notify pgrst, 'reload schema';
commit;
