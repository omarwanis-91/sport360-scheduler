-- Replace helper-function admin checks with direct auth.uid() checks.
-- This avoids any mismatch where the app can load an admin profile, but RLS
-- insert/update checks still evaluate public.is_admin() as false.

grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.departments to authenticated;
grant insert, update, delete on public.shift_types to authenticated;
grant insert, update, delete on public.people to authenticated;
grant insert, update, delete on public.person_defaults to authenticated;
grant insert, update, delete on public.schedule_overrides to authenticated;
grant insert, update, delete on public.manager_defaults to authenticated;
grant insert, update, delete on public.manager_overrides to authenticated;
grant insert, update on public.time_off_requests to authenticated;
grant update on public.profiles to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'departments',
    'shift_types',
    'people',
    'person_defaults',
    'schedule_overrides',
    'manager_defaults',
    'manager_overrides'
  ]
  loop
    execute format('drop policy if exists "admins insert %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "admins update %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "admins delete %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "admins manage %s" on public.%I', table_name, table_name);

    execute format(
      'create policy "admins insert %s" on public.%I for insert to authenticated with check (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = ''admin''
        )
      )',
      table_name,
      table_name
    );

    execute format(
      'create policy "admins update %s" on public.%I for update to authenticated using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = ''admin''
        )
      ) with check (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = ''admin''
        )
      )',
      table_name,
      table_name
    );

    execute format(
      'create policy "admins delete %s" on public.%I for delete to authenticated using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = ''admin''
        )
      )',
      table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists "admins update requests" on public.time_off_requests;
create policy "admins update requests" on public.time_off_requests
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles as admin_profiles
      where admin_profiles.id = auth.uid()
        and admin_profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles as admin_profiles
      where admin_profiles.id = auth.uid()
        and admin_profiles.role = 'admin'
    )
  );

drop policy if exists "users create own requests" on public.time_off_requests;
create policy "users create own requests" on public.time_off_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.person_id = time_off_requests.person_id
    )
    and status = 'pending'
  );
