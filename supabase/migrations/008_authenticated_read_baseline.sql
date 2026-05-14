-- Read-side baseline for the app.
-- Admin writes now go through RPC, but the browser still reads schedule data
-- through normal Supabase selects. These policies make the shared schedule
-- readable to every signed-in user, while keeping profiles/requests scoped.

grant usage on schema public to anon, authenticated;

grant select on public.departments to authenticated;
grant select on public.shift_types to authenticated;
grant select on public.people to authenticated;
grant select on public.person_defaults to authenticated;
grant select on public.schedule_overrides to authenticated;
grant select on public.manager_defaults to authenticated;
grant select on public.manager_overrides to authenticated;
grant select on public.profiles to authenticated;
grant select on public.time_off_requests to authenticated;

drop policy if exists "signed in users read departments" on public.departments;
create policy "signed in users read departments" on public.departments
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users read shifts" on public.shift_types;
create policy "signed in users read shifts" on public.shift_types
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users read people" on public.people;
create policy "signed in users read people" on public.people
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users read defaults" on public.person_defaults;
create policy "signed in users read defaults" on public.person_defaults
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users read overrides" on public.schedule_overrides;
create policy "signed in users read overrides" on public.schedule_overrides
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users read manager defaults" on public.manager_defaults;
create policy "signed in users read manager defaults" on public.manager_defaults
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "signed in users read manager overrides" on public.manager_overrides;
create policy "signed in users read manager overrides" on public.manager_overrides
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "users read own profile or admins read all" on public.profiles;
create policy "users read own profile or admins read all" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.profiles as admin_profiles
      where admin_profiles.id = auth.uid()
        and admin_profiles.role = 'admin'
    )
  );

drop policy if exists "users read own requests or admins read all" on public.time_off_requests;
create policy "users read own requests or admins read all" on public.time_off_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles as admin_profiles
      where admin_profiles.id = auth.uid()
        and admin_profiles.role = 'admin'
    )
  );
