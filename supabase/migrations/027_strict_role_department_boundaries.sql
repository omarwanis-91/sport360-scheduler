create or replace function public.profile_directly_belongs_to_department(
  p_profile_id uuid,
  p_department_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employee_profile_departments membership
    where membership.profile_id = p_profile_id
      and membership.department_id = p_department_id
  )
  or exists (
    select 1
    from public.employee_profiles profile
    where profile.id = p_profile_id
      and profile.department_id = p_department_id
  );
$$;

create or replace function public.current_user_can_access_department(p_department_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = 'admin'
    or public.profile_directly_belongs_to_department(public.current_profile_id(), p_department_id);
$$;

create or replace function public.current_user_can_manage_department(p_department_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = 'admin'
    or (
      public.current_role() = 'lead'
      and public.profile_directly_belongs_to_department(public.current_profile_id(), p_department_id)
    );
$$;

create or replace function public.profile_is_unassigned(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employee_profiles profile
    where profile.id = p_profile_id
      and profile.department_id is null
      and not exists (
        select 1
        from public.employee_profile_departments membership
        where membership.profile_id = profile.id
      )
  );
$$;

create or replace function public.current_user_can_read_profile(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with current_departments as (
    select membership.department_id
    from public.employee_profile_departments membership
    where membership.profile_id = public.current_profile_id()
    union
    select profile.department_id
    from public.employee_profiles profile
    where profile.id = public.current_profile_id()
      and profile.department_id is not null
  ),
  target_departments as (
    select membership.department_id
    from public.employee_profile_departments membership
    where membership.profile_id = p_profile_id
    union
    select profile.department_id
    from public.employee_profiles profile
    where profile.id = p_profile_id
      and profile.department_id is not null
  )
  select public.current_role() = 'admin'
    or p_profile_id = public.current_profile_id()
    or exists (
      select 1
      from current_departments current_department
      join target_departments target_department using (department_id)
    )
    or (
      public.current_role() = 'lead'
      and public.profile_is_unassigned(p_profile_id)
    );
$$;

create or replace function public.current_user_can_manage_profile(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = 'admin'
    or (
      public.current_role() = 'lead'
      and exists (
        select 1
        from public.employee_profile_departments current_membership
        join public.employee_profile_departments target_membership
          on target_membership.department_id = current_membership.department_id
        where current_membership.profile_id = public.current_profile_id()
          and target_membership.profile_id = p_profile_id
      )
    )
    or (
      public.current_role() = 'lead'
      and exists (
        select 1
        from public.employee_profiles current_profile
        join public.employee_profiles target_profile
          on target_profile.department_id = current_profile.department_id
        where current_profile.id = public.current_profile_id()
          and current_profile.department_id is not null
          and target_profile.id = p_profile_id
      )
    );
$$;

create or replace function public.current_user_can_read_profile_photo(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employee_profiles profile
    where profile.id::text = split_part(p_object_name, '/', 1)
      and public.current_user_can_read_profile(profile.id)
  );
$$;

revoke all on function public.profile_directly_belongs_to_department(uuid, uuid) from public, anon;
revoke all on function public.current_user_can_access_department(uuid) from public, anon;
revoke all on function public.current_user_can_manage_department(uuid) from public, anon;
revoke all on function public.profile_is_unassigned(uuid) from public, anon;
revoke all on function public.current_user_can_read_profile(uuid) from public, anon;
revoke all on function public.current_user_can_manage_profile(uuid) from public, anon;
revoke all on function public.current_user_can_read_profile_photo(text) from public, anon;

grant execute on function public.profile_directly_belongs_to_department(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_access_department(uuid) to authenticated;
grant execute on function public.current_user_can_manage_department(uuid) to authenticated;
grant execute on function public.profile_is_unassigned(uuid) to authenticated;
grant execute on function public.current_user_can_read_profile(uuid) to authenticated;
grant execute on function public.current_user_can_manage_profile(uuid) to authenticated;
grant execute on function public.current_user_can_read_profile_photo(text) to authenticated;

drop policy if exists "claimed users can read departments" on public.departments;
drop policy if exists "role scoped departments read" on public.departments;
create policy "role scoped departments read"
on public.departments for select to authenticated
using (public.current_user_can_access_department(id));

drop policy if exists "profiles visible to claimed users" on public.employee_profiles;
drop policy if exists "role scoped profiles read" on public.employee_profiles;
create policy "role scoped profiles read"
on public.employee_profiles for select to authenticated
using (public.current_user_can_read_profile(id));

drop policy if exists "claimed users read profile departments" on public.employee_profile_departments;
drop policy if exists "role scoped profile departments read" on public.employee_profile_departments;
create policy "role scoped profile departments read"
on public.employee_profile_departments for select to authenticated
using (
  public.current_user_can_access_department(department_id)
  and public.current_user_can_read_profile(profile_id)
);

drop policy if exists "claimed users read rotations" on public.rotation_versions;
drop policy if exists "role scoped rotations read" on public.rotation_versions;
create policy "role scoped rotations read"
on public.rotation_versions for select to authenticated
using (public.current_user_can_read_profile(profile_id));

drop policy if exists "claimed users read schedule overrides" on public.schedule_overrides;
drop policy if exists "role scoped schedule overrides read" on public.schedule_overrides;
create policy "role scoped schedule overrides read"
on public.schedule_overrides for select to authenticated
using (public.current_user_can_read_profile(profile_id));

drop policy if exists "claimed users read daily leads" on public.department_daily_leads;
drop policy if exists "role scoped daily leads read" on public.department_daily_leads;
create policy "role scoped daily leads read"
on public.department_daily_leads for select to authenticated
using (public.current_user_can_access_department(department_id));

drop policy if exists "claimed users read lead rotations" on public.department_lead_rotation_versions;
drop policy if exists "role scoped lead rotations read" on public.department_lead_rotation_versions;
create policy "role scoped lead rotations read"
on public.department_lead_rotation_versions for select to authenticated
using (public.current_user_can_access_department(department_id));

drop policy if exists "claimed users read profile photos" on storage.objects;
drop policy if exists "role scoped profile photos read" on storage.objects;
create policy "role scoped profile photos read"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos'
  and public.current_user_can_read_profile_photo(name)
);

drop policy if exists "users read own onboarding photos" on storage.objects;
create policy "users read own onboarding photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-onboarding-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() = 'admin'
    or exists (
      select 1
      from public.employee_profiles profile
      where profile.photo_url = 'storage:profile-onboarding-photos/' || storage.objects.name
        and public.current_user_can_read_profile(profile.id)
    )
  )
);

drop policy if exists "admins and leads manage department rotations" on public.rotation_versions;
create policy "admins and leads manage department rotations"
on public.rotation_versions for all to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and effective_start >= current_date
    and public.current_user_can_manage_profile(profile_id)
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and effective_start >= current_date
    and public.current_user_can_manage_profile(profile_id)
  )
);

drop policy if exists "admins and leads manage future overrides" on public.schedule_overrides;
create policy "admins and leads manage future overrides"
on public.schedule_overrides for all to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and shift_date >= current_date
    and public.current_user_can_manage_profile(profile_id)
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and shift_date >= current_date
    and public.current_user_can_manage_profile(profile_id)
  )
);

drop policy if exists "admins and leads manage daily leads" on public.department_daily_leads;
create policy "admins and leads manage daily leads"
on public.department_daily_leads for all to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and lead_date >= current_date
    and public.current_user_can_manage_department(department_id)
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and lead_date >= current_date
    and public.current_user_can_manage_department(department_id)
  )
);

drop policy if exists "admins and leads manage lead rotations" on public.department_lead_rotation_versions;
create policy "admins and leads manage lead rotations"
on public.department_lead_rotation_versions for all to authenticated
using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and effective_start >= current_date
    and public.current_user_can_manage_department(department_id)
  )
)
with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'lead'
    and effective_start >= current_date
    and public.current_user_can_manage_department(department_id)
  )
);

drop policy if exists "vacation visible to owner lead or admin" on public.vacation_requests;
create policy "vacation visible to owner lead or admin"
on public.vacation_requests for select to authenticated
using (
  public.current_role() = 'admin'
  or exists (
    select 1
    from public.employee_profiles profile
    where profile.id = vacation_requests.profile_id
      and profile.user_id = auth.uid()
  )
  or (
    public.current_role() = 'lead'
    and public.current_user_can_manage_profile(vacation_requests.profile_id)
  )
);

drop policy if exists "employees create own vacation requests" on public.vacation_requests;
drop policy if exists "admins and leads create vacation requests" on public.vacation_requests;
drop policy if exists "admins or owners create vacation requests" on public.vacation_requests;
create policy "admins or owners create vacation requests"
on public.vacation_requests for insert to authenticated
with check (
  public.current_role() = 'admin'
  or exists (
    select 1
    from public.employee_profiles profile
    where profile.id = vacation_requests.profile_id
      and profile.user_id = auth.uid()
  )
);

drop policy if exists "admins manage roles" on public.user_roles;

create unique index if not exists user_roles_single_admin
on public.user_roles ((role))
where role = 'admin';

drop function if exists public.update_own_profile(uuid, text, text, text);
drop function if exists public.update_own_profile(uuid, text, text);

create function public.update_own_profile(
  p_profile_id uuid,
  p_full_name text,
  p_photo_url text
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_photo_url text;
  updated_profile public.employee_profiles;
  clean_name text := nullif(btrim(p_full_name), '');
begin
  if auth.uid() is null or p_profile_id is distinct from public.current_profile_id() then
    raise exception 'Profile not found or not owned by current user';
  end if;

  if clean_name is null or char_length(clean_name) > 120 then
    raise exception 'Name must be between 1 and 120 characters';
  end if;

  select photo_url into current_photo_url
  from public.employee_profiles
  where id = p_profile_id
    and user_id = auth.uid();

  if p_photo_url is distinct from current_photo_url
    and p_photo_url is not null
    and p_photo_url <> ''
    and p_photo_url not like 'storage:profile-photos/' || p_profile_id::text || '/%'
  then
    raise exception 'Invalid profile photo reference';
  end if;

  update public.employee_profiles
  set
    full_name = clean_name,
    photo_url = nullif(p_photo_url, ''),
    updated_at = now()
  where id = p_profile_id
    and user_id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found or not owned by current user';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.update_profile_hierarchy(
  p_profile_id uuid,
  p_seniority_level text
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.employee_profiles;
begin
  if p_seniority_level not in ('manager', 'lead', 'artist') then
    raise exception 'Invalid hierarchy role';
  end if;

  if not (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'lead'
      and public.current_user_can_manage_profile(p_profile_id)
    )
  ) then
    raise exception 'You can only change hierarchy inside your department';
  end if;

  update public.employee_profiles
  set seniority_level = p_seniority_level,
      updated_at = now()
  where id = p_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Employee profile not found';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'profile.hierarchy_updated',
    'profile',
    p_profile_id::text,
    jsonb_build_object('seniority_level', p_seniority_level)
  );

  return updated_profile;
end;
$$;

create or replace function public.add_profile_to_department(
  p_profile_id uuid,
  p_department_id uuid
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.employee_profiles;
begin
  if not public.current_user_can_manage_department(p_department_id) then
    raise exception 'You can only add members to your department';
  end if;

  if public.current_role() = 'lead' and not public.profile_is_unassigned(p_profile_id) then
    raise exception 'Leads can add only currently unassigned profiles';
  end if;

  if not exists (select 1 from public.employee_profiles where id = p_profile_id) then
    raise exception 'Employee profile not found';
  end if;

  insert into public.employee_profile_departments (profile_id, department_id)
  values (p_profile_id, p_department_id)
  on conflict do nothing;

  update public.employee_profiles
  set department_id = coalesce(department_id, p_department_id),
      updated_at = now()
  where id = p_profile_id
  returning * into updated_profile;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'profile.department_assigned',
    'profile',
    p_profile_id::text,
    jsonb_build_object('department_id', p_department_id)
  );

  return updated_profile;
end;
$$;

create or replace function public.remove_profile_from_department(
  p_profile_id uuid,
  p_department_id uuid
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  replacement_department_id uuid;
  updated_profile public.employee_profiles;
begin
  if not public.current_user_can_manage_department(p_department_id) then
    raise exception 'You can only remove members from your department';
  end if;

  if public.current_role() = 'lead' and p_profile_id = public.current_profile_id() then
    raise exception 'Leads cannot remove their own department access';
  end if;

  if not public.profile_directly_belongs_to_department(p_profile_id, p_department_id) then
    raise exception 'That person is not assigned to this department';
  end if;

  delete from public.employee_profile_departments
  where profile_id = p_profile_id
    and department_id = p_department_id;

  select membership.department_id into replacement_department_id
  from public.employee_profile_departments membership
  where membership.profile_id = p_profile_id
  order by membership.created_at, membership.department_id
  limit 1;

  update public.employee_profiles
  set department_id = case
        when department_id = p_department_id then replacement_department_id
        else department_id
      end,
      updated_at = now()
  where id = p_profile_id
  returning * into updated_profile;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'profile.department_removed',
    'profile',
    p_profile_id::text,
    jsonb_build_object('department_id', p_department_id)
  );

  return updated_profile;
end;
$$;

create or replace function public.set_user_access_role(
  p_user_id uuid,
  p_role text
)
returns public.user_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_role public.app_role;
  saved_role public.user_roles;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;

  if p_role not in ('lead', 'employee') then
    raise exception 'The sole Admin role cannot be assigned or changed here';
  end if;

  select role into existing_role
  from public.user_roles
  where user_id = p_user_id;

  if existing_role = 'admin' then
    raise exception 'The sole Admin role cannot be changed';
  end if;

  insert into public.user_roles (user_id, role)
  values (p_user_id, p_role::public.app_role)
  on conflict (user_id) do update set role = excluded.role
  returning * into saved_role;

  return saved_role;
end;
$$;

create or replace function public.unlink_profile_account(
  p_profile_id uuid
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  target_role public.app_role;
  updated_profile public.employee_profiles;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;

  select profile.user_id, role.role
  into target_user_id, target_role
  from public.employee_profiles profile
  left join public.user_roles role on role.user_id = profile.user_id
  where profile.id = p_profile_id;

  if not found then
    raise exception 'Employee profile not found';
  end if;

  if target_role = 'admin' then
    raise exception 'The sole Admin account cannot be unlinked';
  end if;

  update public.employee_profiles
  set user_id = null,
      updated_at = now()
  where id = p_profile_id
  returning * into updated_profile;

  if target_user_id is not null then
    delete from public.user_roles where user_id = target_user_id;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'profile.unlinked',
    'profile',
    p_profile_id::text,
    jsonb_build_object('user_id', target_user_id)
  );

  return updated_profile;
end;
$$;

create or replace function public.delete_admin_profile(
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  target_role public.app_role;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only Admins can delete employee profiles';
  end if;

  select profile.user_id, role.role
  into target_user_id, target_role
  from public.employee_profiles profile
  left join public.user_roles role on role.user_id = profile.user_id
  where profile.id = p_profile_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if target_role = 'admin' then
    raise exception 'The sole Admin profile cannot be deleted';
  end if;

  delete from public.department_lead_rotation_versions
  where pattern ? p_profile_id::text;

  if target_user_id is not null then
    delete from public.user_roles where user_id = target_user_id;
  end if;

  delete from public.employee_profiles where id = p_profile_id;
end;
$$;

create or replace function public.validate_department_lead_rotation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  profile_id uuid;
begin
  for profile_id in
    select value::text::uuid
    from jsonb_array_elements_text(new.pattern)
  loop
    if public.current_role() = 'lead'
      and not public.profile_directly_belongs_to_department(profile_id, new.department_id)
    then
      raise exception 'Lead assignments must stay inside your department';
    end if;

    if public.current_role() <> 'lead'
      and not public.profile_belongs_to_department(profile_id, new.department_id)
    then
      raise exception 'Lead profile % is not assigned to the selected department scope', profile_id;
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.validate_department_daily_lead()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.current_role() = 'lead'
    and not public.profile_directly_belongs_to_department(new.lead_profile_id, new.department_id)
  then
    raise exception 'Daily lead assignments must stay inside your department';
  end if;

  if public.current_role() <> 'lead'
    and not public.profile_belongs_to_department(new.lead_profile_id, new.department_id)
  then
    raise exception 'Daily lead must be assigned to the selected department scope';
  end if;

  return new;
end;
$$;

revoke all on function public.update_own_profile(uuid, text, text) from public, anon;
revoke all on function public.update_profile_hierarchy(uuid, text) from public, anon;
revoke all on function public.add_profile_to_department(uuid, uuid) from public, anon;
revoke all on function public.remove_profile_from_department(uuid, uuid) from public, anon;
revoke all on function public.set_user_access_role(uuid, text) from public, anon;
revoke all on function public.unlink_profile_account(uuid) from public, anon;
revoke all on function public.delete_admin_profile(uuid) from public, anon;

grant execute on function public.update_own_profile(uuid, text, text) to authenticated;
grant execute on function public.update_profile_hierarchy(uuid, text) to authenticated;
grant execute on function public.add_profile_to_department(uuid, uuid) to authenticated;
grant execute on function public.remove_profile_from_department(uuid, uuid) to authenticated;
grant execute on function public.set_user_access_role(uuid, text) to authenticated;
grant execute on function public.unlink_profile_account(uuid) to authenticated;
grant execute on function public.delete_admin_profile(uuid) to authenticated;

create or replace function public.decide_vacation_request(
  p_request_id uuid,
  p_decision vacation_status
)
returns public.vacation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.vacation_requests;
  target_profile public.employee_profiles;
  deducted integer := 0;
  decided_request public.vacation_requests;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into target_request
  from public.vacation_requests
  where id = p_request_id
  for update;

  if target_request.id is null then
    raise exception 'Vacation request not found';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'Only pending vacation requests can be decided';
  end if;

  select * into target_profile
  from public.employee_profiles
  where id = target_request.profile_id
  for update;

  if target_profile.id is null then
    raise exception 'Vacation request profile not found';
  end if;

  if not (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'lead'
      and public.current_user_can_manage_profile(target_profile.id)
    )
  ) then
    raise exception 'Not allowed to decide this vacation request';
  end if;

  if p_decision = 'approved' then
    deducted := public.vacation_workday_count(
      target_request.profile_id,
      target_request.start_date,
      target_request.end_date
    );

    if target_profile.remaining_vacation_days < deducted then
      raise exception 'Insufficient vacation balance';
    end if;

    update public.employee_profiles
    set remaining_vacation_days = remaining_vacation_days - deducted,
        updated_at = now()
    where id = target_profile.id;

    perform public.apply_vacation_overrides(
      target_request.profile_id,
      target_request.start_date,
      target_request.end_date,
      target_request.id
    );
  end if;

  update public.vacation_requests
  set status = p_decision,
      decided_by = auth.uid(),
      decided_at = now(),
      deducted_days = case when p_decision = 'approved' then deducted else 0 end
  where id = target_request.id
  returning * into decided_request;

  return decided_request;
end;
$$;

create or replace function public.save_department_rotation_versions(
  p_department_id uuid,
  p_effective_start date,
  p_patterns_json jsonb
)
returns setof public.rotation_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  pattern_entry jsonb;
  target_profile public.employee_profiles%rowtype;
  inserted_rotation public.rotation_versions%rowtype;
  profile_id_value uuid;
  pattern_value text[];
begin
  if auth.uid() is null or not public.is_claimed_user() then
    raise exception 'Authentication required';
  end if;

  if not public.current_user_can_manage_department(p_department_id) then
    raise exception 'You can only save rotations inside your department';
  end if;

  if public.current_role() = 'lead' and p_effective_start < current_date then
    raise exception 'Department Leads cannot create past rotation versions';
  end if;

  if p_effective_start is null then
    raise exception 'Effective start is required';
  end if;

  if jsonb_typeof(p_patterns_json) <> 'array' or jsonb_array_length(p_patterns_json) = 0 then
    raise exception 'At least one profile pattern is required';
  end if;

  if (
    select count(*) <> count(distinct entry->>'profileId')
    from jsonb_array_elements(p_patterns_json) entry
  ) then
    raise exception 'Each profile can appear only once';
  end if;

  for pattern_entry in select value from jsonb_array_elements(p_patterns_json)
  loop
    begin
      profile_id_value := (pattern_entry->>'profileId')::uuid;
    exception when others then
      raise exception 'Every pattern requires a valid profileId';
    end;

    select * into target_profile
    from public.employee_profiles
    where id = profile_id_value;

    if target_profile.id is null then
      raise exception 'Employee profile not found';
    end if;

    if public.current_role() = 'lead'
      and not public.profile_directly_belongs_to_department(profile_id_value, p_department_id)
    then
      raise exception 'Department Leads can rotate only direct members of their department';
    end if;

    if public.current_role() = 'admin'
      and not public.profile_belongs_to_department(profile_id_value, p_department_id)
    then
      raise exception 'Profile % does not belong to the selected department scope', profile_id_value;
    end if;

    if jsonb_typeof(pattern_entry->'pattern') <> 'array'
      or jsonb_array_length(pattern_entry->'pattern') <> 7
    then
      raise exception 'Profile % requires exactly seven weekday slots', profile_id_value;
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(pattern_entry->'pattern') status_id
      where status_id not in ('morning', 'midday', 'night', 'weekend')
    ) then
      raise exception 'Profile % contains a non-rotation status', profile_id_value;
    end if;

    if exists (
      select 1
      from public.rotation_versions
      where profile_id = profile_id_value
        and effective_start = p_effective_start
    ) then
      raise exception 'Profile % already has a rotation version on %', profile_id_value, p_effective_start;
    end if;

    select array_agg(status_id order by ordinal)
    into pattern_value
    from jsonb_array_elements_text(pattern_entry->'pattern')
      with ordinality values_with_order(status_id, ordinal);

    insert into public.rotation_versions (profile_id, effective_start, pattern)
    values (profile_id_value, p_effective_start, pattern_value)
    returning * into inserted_rotation;

    return next inserted_rotation;
  end loop;
end;
$$;

revoke all on function public.decide_vacation_request(uuid, vacation_status) from public, anon;
revoke all on function public.save_department_rotation_versions(uuid, date, jsonb) from public, anon;
grant execute on function public.decide_vacation_request(uuid, vacation_status) to authenticated;
grant execute on function public.save_department_rotation_versions(uuid, date, jsonb) to authenticated;

select pg_notify('pgrst', 'reload schema');
