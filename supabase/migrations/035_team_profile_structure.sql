-- Apply after 034. Run audit 023 first; parent-only assignments require an explicit team choice.
begin;
lock table public.departments,public.employee_profiles,public.employee_profile_departments in share row exclusive mode;
alter table public.departments add column if not exists is_container boolean not null default false;

do $$ declare unresolved text;
begin
  with containers as (select d.id from public.departments d where d.is_container
    or lower(regexp_replace(d.name,'[^a-zA-Z]','','g'))='videounit'
    or exists(select 1 from public.departments c where c.parent_department_id=d.id)),
  memberships as (select id profile_id,department_id from public.employee_profiles where department_id is not null
    union select profile_id,department_id from public.employee_profile_departments)
  select string_agg(p.id::text,', ') into unresolved from public.employee_profiles p
  where exists(select 1 from memberships m join containers c on c.id=m.department_id where m.profile_id=p.id)
    and not exists(select 1 from memberships m where m.profile_id=p.id and not exists(select 1 from containers c where c.id=m.department_id));
  if unresolved is not null then raise exception 'Container-only assignments need Admin review before migration 035. Assign a leaf team first. Profile IDs: %',unresolved; end if;
end $$;

update public.departments d set is_container=true where lower(regexp_replace(d.name,'[^a-zA-Z]','','g'))='videounit'
  or exists(select 1 from public.departments c where c.parent_department_id=d.id);
insert into public.employee_profile_departments(profile_id,department_id)
select p.id,p.department_id from public.employee_profiles p join public.departments d on d.id=p.department_id where not d.is_container
on conflict do nothing;
update public.employee_profiles p set department_id=(select m.department_id from public.employee_profile_departments m
  join public.departments d on d.id=m.department_id where m.profile_id=p.id and not d.is_container order by m.department_id limit 1)
where exists(select 1 from public.departments d where d.id=p.department_id and d.is_container);
delete from public.employee_profile_departments m using public.departments d where d.id=m.department_id and d.is_container;

create or replace function public.team_is_assignable(p_department_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.departments d where d.id=p_department_id and not d.is_container
    and not exists(select 1 from public.departments c where c.parent_department_id=d.id))
$$;

create or replace function public.profile_team_ids(p_profile_id uuid) returns uuid[]
language sql stable security definer set search_path=public as $$
  select coalesce(array_agg(id order by id),'{}'::uuid[]) from (
    select p.department_id id from public.employee_profiles p where p.id=p_profile_id and public.team_is_assignable(p.department_id)
    union select m.department_id from public.employee_profile_departments m where m.profile_id=p_profile_id and public.team_is_assignable(m.department_id)
  ) teams
$$;

create or replace function public.derived_profile_title(p_profile_id uuid,p_position text,p_anchor uuid) returns text
language sql stable security definer set search_path=public as $$
  with teams as (select p_anchor id union select m.department_id from public.employee_profile_departments m where m.profile_id=p_profile_id),
  kinds as (select coalesce(bool_or(lower(regexp_replace(d.name,'[^a-zA-Z]','','g'))='videoedit'),false) video,
    coalesce(bool_or(lower(regexp_replace(d.name,'[^a-zA-Z]','','g')) in ('motion','motiongraphics')),false) motion
    from public.departments d join teams t on t.id=d.id where public.team_is_assignable(d.id))
  select case when video and motion then case p_position when 'manager' then 'Head of Video Unit' when 'lead' then 'Lead Hybrid' else 'Hybrid Artist' end
    when video then case p_position when 'manager' then 'Head of Video Team' when 'lead' then 'Lead Video Editor' else 'Video Editor' end
    when motion then case p_position when 'manager' then 'Head of Motion Graphics' when 'lead' then 'Lead Motion Graphics' else 'Motion Graphics' end
    else case p_position when 'manager' then 'Manager' when 'lead' then 'Lead' else 'Artist' end end from kinds
$$;

create or replace function public.current_user_is_team_manager() returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and public.current_role()='lead' and exists(select 1 from public.employee_profiles p
    where p.id=public.current_profile_id() and p.seniority_level='manager' and cardinality(public.profile_team_ids(p.id))>0)
$$;

create or replace function public.current_user_can_manage_team_structure(p_department_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.team_is_assignable(p_department_id) and (public.current_role()='admin'
    or (public.current_user_is_team_manager() and public.profile_directly_belongs_to_department(public.current_profile_id(),p_department_id)))
$$;

create or replace function public.current_user_can_edit_profile_teams(p_profile_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.employee_profiles p where p.id=p_profile_id and (
    public.current_role()='admin' or (public.current_user_is_team_manager()
      and not exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='admin')
      and (cardinality(public.profile_team_ids(p.id))=0 or public.profile_team_ids(p.id)&&public.profile_team_ids(public.current_profile_id())))))
$$;

create or replace function public.current_user_can_edit_profile_position(p_profile_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.current_user_can_edit_profile_teams(p_profile_id) and (public.current_role()='admin'
    or public.profile_team_ids(p_profile_id)<@public.profile_team_ids(public.current_profile_id()))
$$;

create or replace function public.current_user_can_read_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.current_role()='admin' or p_profile_id=public.current_profile_id()
    or public.profile_team_ids(p_profile_id)&&public.profile_team_ids(public.current_profile_id())
    or (public.current_user_is_team_manager() and public.profile_is_unassigned(p_profile_id))
$$;

create or replace function public.validate_profile_teams(p_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$ begin
  perform 1 from public.departments where id=any(coalesce(p_ids,'{}')) order by id for update;
  if exists(select 1 from unnest(coalesce(p_ids,'{}')) d(id) where id is null or not public.team_is_assignable(id)) then
    raise exception 'Choose teams only; containers cannot have people assigned directly'; end if;
end $$;

create or replace function public.lock_profile_structure(p_profile_id uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
  perform 1 from public.user_roles where user_id=auth.uid() for update;
  perform 1 from public.employee_profiles where id in (public.current_profile_id(),p_profile_id) order by id for update;
end $$;

create or replace function public.guard_profile_team_and_title() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  if new.department_id is not null then perform public.validate_profile_teams(array[new.department_id]); end if;
  new.title:=public.derived_profile_title(new.id,new.seniority_level,new.department_id);
  return new;
end $$;
create trigger profile_team_and_title before insert or update of department_id,seniority_level,title
on public.employee_profiles for each row execute function public.guard_profile_team_and_title();

create or replace function public.guard_profile_membership_team() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  perform public.validate_profile_teams(array[new.department_id]); return new;
end $$;
create trigger profile_membership_team before insert or update on public.employee_profile_departments
for each row execute function public.guard_profile_membership_team();

create or replace function public.refresh_membership_profile_title() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  if tg_op in ('DELETE','UPDATE') then update public.employee_profiles p set title=public.derived_profile_title(p.id,p.seniority_level,p.department_id) where p.id=old.profile_id; end if;
  if tg_op in ('INSERT','UPDATE') then update public.employee_profiles p set title=public.derived_profile_title(p.id,p.seniority_level,p.department_id) where p.id=new.profile_id; end if;
  return null;
end $$;
create trigger profile_membership_title after insert or update or delete on public.employee_profile_departments
for each row execute function public.refresh_membership_profile_title();

create or replace function public.guard_department_container() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  if lower(regexp_replace(new.name,'[^a-zA-Z]','','g'))='videounit'
    or exists(select 1 from public.departments d where d.parent_department_id=new.id) then new.is_container:=true; end if;
  if new.is_container and (exists(select 1 from public.employee_profiles p where p.department_id=new.id)
    or exists(select 1 from public.employee_profile_departments m where m.department_id=new.id)) then
    raise exception 'Move people to leaf teams before making this department a container'; end if;
  if new.parent_department_id is not null then
    perform 1 from public.departments where id=new.parent_department_id for update;
    if exists(select 1 from public.employee_profiles p where p.department_id=new.parent_department_id)
      or exists(select 1 from public.employee_profile_departments m where m.department_id=new.parent_department_id) then
      raise exception 'Move people to leaf teams before adding subdepartments'; end if;
    update public.departments set is_container=true where id=new.parent_department_id and not is_container;
  end if;
  return new;
end $$;
create trigger department_container before insert or update of parent_department_id,is_container,name on public.departments
for each row execute function public.guard_department_container();
create or replace function public.refresh_department_profile_titles() returns trigger
language plpgsql security definer set search_path=public as $$ begin
  update public.employee_profiles p set title=public.derived_profile_title(p.id,p.seniority_level,p.department_id)
  where p.department_id=new.id or exists(select 1 from public.employee_profile_departments m where m.profile_id=p.id and m.department_id=new.id);
  return null;
end $$;
create trigger department_profile_titles after update of name on public.departments
for each row execute function public.refresh_department_profile_titles();
update public.employee_profiles p set title=public.derived_profile_title(p.id,p.seniority_level,p.department_id);

create or replace function public.save_admin_profile(
  p_profile_id uuid,p_employee_code text,p_email text,p_full_name text,p_title text,p_seniority_level text,
  p_department_ids uuid[],p_photo_url text,p_yearly_vacation_days integer,p_remaining_vacation_days integer,p_user_id uuid
) returns public.employee_profiles language plpgsql security definer set search_path=public as $$
declare result public.employee_profiles;
begin
  if auth.uid() is null or public.current_role()<>'admin' then raise exception 'Only Admins can update employee profiles'; end if;
  if p_seniority_level is null or p_seniority_level not in ('artist','lead','manager') then raise exception 'Invalid position'; end if;
  perform 1 from public.employee_profiles where id=p_profile_id for update;
  perform public.validate_profile_teams(p_department_ids);
  update public.employee_profiles set employee_code=coalesce(nullif(trim(p_employee_code),''),employee_code),
    email=nullif(trim(p_email),''),full_name=nullif(trim(p_full_name),''),seniority_level=p_seniority_level,
    department_id=p_department_ids[1],photo_url=p_photo_url,yearly_vacation_days=p_yearly_vacation_days,
    remaining_vacation_days=p_remaining_vacation_days,user_id=p_user_id,updated_at=now() where id=p_profile_id;
  if not found then raise exception 'Profile not found'; end if;
  delete from public.employee_profile_departments where profile_id=p_profile_id;
  insert into public.employee_profile_departments(profile_id,department_id) select p_profile_id,id from unnest(coalesce(p_department_ids,'{}')) d(id) on conflict do nothing;
  select * into result from public.employee_profiles where id=p_profile_id;return result;
end $$;

create or replace function public.create_admin_team_profile(p_profile_id uuid,p_email text,p_full_name text,p_seniority_level text,
  p_department_ids uuid[],p_photo_url text,p_yearly_vacation_days integer,p_remaining_vacation_days integer)
returns public.employee_profiles language plpgsql security definer set search_path=public as $$
declare result public.employee_profiles;
begin
  if auth.uid() is null or public.current_role()<>'admin' then raise exception 'Only Admins can create employee profiles'; end if;
  if p_seniority_level is null or p_seniority_level not in ('artist','lead','manager') then raise exception 'Invalid position'; end if;
  perform public.validate_profile_teams(p_department_ids);
  insert into public.employee_profiles(id,employee_code,email,full_name,title,seniority_level,department_id,photo_url,yearly_vacation_days,remaining_vacation_days)
    values(p_profile_id,'SCH-'||upper(replace(p_profile_id::text,'-','')),nullif(trim(p_email),''),nullif(trim(p_full_name),''),'',p_seniority_level,p_department_ids[1],p_photo_url,p_yearly_vacation_days,p_remaining_vacation_days);
  insert into public.employee_profile_departments(profile_id,department_id) select p_profile_id,id from unnest(coalesce(p_department_ids,'{}')) d(id) on conflict do nothing;
  select * into result from public.employee_profiles where id=p_profile_id;return result;
end $$;

create or replace function public.save_managed_profile_structure(p_profile_id uuid,p_seniority_level text,p_department_ids uuid[],p_full_name text default null,p_photo_url text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.employee_profiles; result public.employee_profiles; merged uuid[];
begin
  if auth.uid() is null or not public.is_claimed_user() then raise exception 'Authentication required'; end if;
  perform public.lock_profile_structure(p_profile_id);
  select * into strict p from public.employee_profiles where id=p_profile_id;
  if not public.current_user_can_edit_profile_teams(p_profile_id) then raise exception 'Only Admin or a Manager with Lead access can change this team structure'; end if;
  if p_seniority_level is null or p_seniority_level not in ('artist','lead','manager') then raise exception 'Invalid position'; end if;
  if p.seniority_level is distinct from p_seniority_level and not public.current_user_can_edit_profile_position(p_profile_id) then
    raise exception 'Position changes require management of all of this person''s teams'; end if;
  perform public.validate_profile_teams(p_department_ids);
  if public.current_role()<>'admin' and exists(select 1 from unnest(coalesce(p_department_ids,'{}')) d(id) where not public.current_user_can_manage_team_structure(id)) then
    raise exception 'Choose only your own teams'; end if;
  if public.current_role()<>'admin' and p_profile_id=public.current_profile_id()
    and not public.profile_team_ids(p_profile_id)<@coalesce(p_department_ids,'{}') then raise exception 'Managers cannot remove their own team access'; end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into merged from (
    select id from unnest(public.profile_team_ids(p_profile_id)) d(id) where public.current_role()<>'admin' and not public.current_user_can_manage_team_structure(id)
    union select id from unnest(coalesce(p_department_ids,'{}')) d(id)) teams;
  update public.employee_profiles set department_id=merged[1],seniority_level=p_seniority_level,updated_at=now() where id=p_profile_id;
  delete from public.employee_profile_departments where profile_id=p_profile_id;
  insert into public.employee_profile_departments(profile_id,department_id) select p_profile_id,id from unnest(merged) d(id);
  if p_full_name is not null then
    if p_profile_id<>public.current_profile_id() then raise exception 'Only the profile owner can update their identity here'; end if;
    perform public.update_own_profile(p_profile_id,p_full_name,p_photo_url);
  end if;
  select * into result from public.employee_profiles where id=p_profile_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,detail) values(auth.uid(),'profile.structure_updated','profile',p_profile_id::text,
    jsonb_build_object('seniority_level',p_seniority_level,'department_ids',merged));
  return jsonb_build_object('profile',to_jsonb(result),'department_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from unnest(merged) d(id) where public.current_user_can_access_department(id)),
    'can_edit_teams',public.current_user_can_edit_profile_teams(p_profile_id),'can_edit_position',public.current_user_can_edit_profile_position(p_profile_id));
end $$;

create or replace function public.update_profile_hierarchy(p_profile_id uuid,p_seniority_level text)
returns public.employee_profiles language plpgsql security definer set search_path=public as $$
declare result public.employee_profiles; selected uuid[];
begin
  perform public.lock_profile_structure(p_profile_id);
  if not public.current_user_can_edit_profile_position(p_profile_id) then raise exception 'Only Admin or a Manager with Lead access can change this position'; end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into selected from unnest(public.profile_team_ids(p_profile_id)) d(id)
    where public.current_role()='admin' or public.current_user_can_manage_team_structure(id);
  perform public.save_managed_profile_structure(p_profile_id,p_seniority_level,selected);
  select * into result from public.employee_profiles where id=p_profile_id;return result;
end $$;

create or replace function public.add_profile_to_department(p_profile_id uuid,p_department_id uuid)
returns public.employee_profiles language plpgsql security definer set search_path=public as $$
declare p public.employee_profiles; selected uuid[];
begin
  perform public.lock_profile_structure(p_profile_id);
  if not public.current_user_can_manage_team_structure(p_department_id) then raise exception 'Only Admin or a Manager with Lead access can assign this team'; end if;
  select * into strict p from public.employee_profiles where id=p_profile_id;
  select coalesce(array_agg(id),'{}'::uuid[]) into selected from (select id from unnest(public.profile_team_ids(p_profile_id)) d(id)
    where public.current_role()='admin' or public.current_user_can_manage_team_structure(id) union select p_department_id) teams;
  perform public.save_managed_profile_structure(p_profile_id,p.seniority_level,selected);
  select * into p from public.employee_profiles where id=p_profile_id;return p;
end $$;
create or replace function public.remove_profile_from_department(p_profile_id uuid,p_department_id uuid)
returns public.employee_profiles language plpgsql security definer set search_path=public as $$
declare p public.employee_profiles; selected uuid[];
begin
  perform public.lock_profile_structure(p_profile_id);
  if not public.current_user_can_manage_team_structure(p_department_id) then raise exception 'Only Admin or a Manager with Lead access can remove this team'; end if;
  if not public.profile_directly_belongs_to_department(p_profile_id,p_department_id) then raise exception 'That person is not assigned to this team'; end if;
  select * into strict p from public.employee_profiles where id=p_profile_id;
  select coalesce(array_agg(id),'{}'::uuid[]) into selected from unnest(public.profile_team_ids(p_profile_id)) d(id)
    where id<>p_department_id and (public.current_role()='admin' or public.current_user_can_manage_team_structure(id));
  perform public.save_managed_profile_structure(p_profile_id,p.seniority_level,selected);
  select * into p from public.employee_profiles where id=p_profile_id;return p;
end $$;

create or replace function public.get_profile_structure_permissions() returns jsonb
language plpgsql stable security definer set search_path=public as $$ begin
  if auth.uid() is null or not public.is_claimed_user() then raise exception 'Authentication required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('profile_id',p.id,'can_edit_teams',public.current_user_can_edit_profile_teams(p.id),
    'can_edit_position',public.current_user_can_edit_profile_position(p.id))),'[]'::jsonb) from public.employee_profiles p where public.current_user_can_read_profile(p.id));
end $$;

revoke all on function public.team_is_assignable(uuid),public.profile_team_ids(uuid),public.derived_profile_title(uuid,text,uuid),
  public.validate_profile_teams(uuid[]),public.lock_profile_structure(uuid),public.guard_profile_team_and_title(),public.guard_profile_membership_team(),
  public.refresh_membership_profile_title(),public.guard_department_container(),public.refresh_department_profile_titles() from public,anon,authenticated;
revoke all on function public.current_user_is_team_manager(),public.current_user_can_manage_team_structure(uuid),public.current_user_can_edit_profile_teams(uuid),
  public.current_user_can_edit_profile_position(uuid),public.save_managed_profile_structure(uuid,text,uuid[],text,text),public.create_admin_team_profile(uuid,text,text,text,uuid[],text,integer,integer),
  public.get_profile_structure_permissions() from public,anon;
grant execute on function public.current_user_is_team_manager(),public.current_user_can_manage_team_structure(uuid),public.current_user_can_edit_profile_teams(uuid),
  public.current_user_can_edit_profile_position(uuid),public.save_managed_profile_structure(uuid,text,uuid[],text,text),public.create_admin_team_profile(uuid,text,text,text,uuid[],text,integer,integer),
  public.get_profile_structure_permissions() to authenticated;
select pg_notify('pgrst','reload schema');
commit;
