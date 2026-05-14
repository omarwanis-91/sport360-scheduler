-- App-level admin write baseline.
-- Run this after the initial schema/grants migrations. It makes every admin
-- mutation path use the same RLS shape instead of fixing one table at a time.

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

grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_person(uuid) to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.owns_person(target_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and person_id = target_person_id
  );
$$;

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
      'create policy "admins insert %s" on public.%I for insert to authenticated with check (public.is_admin())',
      table_name,
      table_name
    );
    execute format(
      'create policy "admins update %s" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name,
      table_name
    );
    execute format(
      'create policy "admins delete %s" on public.%I for delete to authenticated using (public.is_admin())',
      table_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists "admins update requests" on public.time_off_requests;
create policy "admins update requests" on public.time_off_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Keep member request creation explicit and separate from admin powers.
drop policy if exists "users create own requests" on public.time_off_requests;
create policy "users create own requests" on public.time_off_requests
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.owns_person(person_id)
    and status = 'pending'
  );
