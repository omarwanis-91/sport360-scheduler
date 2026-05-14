drop policy if exists "admins manage departments" on public.departments;
drop policy if exists "admins manage shifts" on public.shift_types;
drop policy if exists "admins manage people" on public.people;
drop policy if exists "admins manage defaults" on public.person_defaults;
drop policy if exists "admins manage overrides" on public.schedule_overrides;
drop policy if exists "admins manage manager defaults" on public.manager_defaults;
drop policy if exists "admins manage manager overrides" on public.manager_overrides;
drop policy if exists "admins update requests" on public.time_off_requests;

create policy "admins insert departments" on public.departments
  for insert to authenticated with check (public.is_admin());
create policy "admins update departments" on public.departments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete departments" on public.departments
  for delete to authenticated using (public.is_admin());

create policy "admins insert shifts" on public.shift_types
  for insert to authenticated with check (public.is_admin());
create policy "admins update shifts" on public.shift_types
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete shifts" on public.shift_types
  for delete to authenticated using (public.is_admin());

create policy "admins insert people" on public.people
  for insert to authenticated with check (public.is_admin());
create policy "admins update people" on public.people
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete people" on public.people
  for delete to authenticated using (public.is_admin());

create policy "admins insert defaults" on public.person_defaults
  for insert to authenticated with check (public.is_admin());
create policy "admins update defaults" on public.person_defaults
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete defaults" on public.person_defaults
  for delete to authenticated using (public.is_admin());

create policy "admins insert overrides" on public.schedule_overrides
  for insert to authenticated with check (public.is_admin());
create policy "admins update overrides" on public.schedule_overrides
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete overrides" on public.schedule_overrides
  for delete to authenticated using (public.is_admin());

create policy "admins insert manager defaults" on public.manager_defaults
  for insert to authenticated with check (public.is_admin());
create policy "admins update manager defaults" on public.manager_defaults
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete manager defaults" on public.manager_defaults
  for delete to authenticated using (public.is_admin());

create policy "admins insert manager overrides" on public.manager_overrides
  for insert to authenticated with check (public.is_admin());
create policy "admins update manager overrides" on public.manager_overrides
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete manager overrides" on public.manager_overrides
  for delete to authenticated using (public.is_admin());

create policy "admins update requests" on public.time_off_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.manager_defaults to authenticated;
grant select, insert, update, delete on public.manager_overrides to authenticated;
grant select, insert, update, delete on public.schedule_overrides to authenticated;
grant select, insert, update, delete on public.person_defaults to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, update on public.time_off_requests to authenticated;
grant execute on function public.is_admin() to authenticated;
