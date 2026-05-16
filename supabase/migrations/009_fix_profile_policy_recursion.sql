-- Fix recursive profile policies.
-- A policy on public.profiles cannot query public.profiles directly without
-- risking infinite recursion. Keep profile reads simple for signed-in users,
-- and use the security-definer admin helper from other table policies.

grant select on public.profiles to authenticated;
grant select on public.time_off_requests to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "users read own profile or admins read all" on public.profiles;
create policy "signed in users read profiles" on public.profiles
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "users read own requests or admins read all" on public.time_off_requests;
create policy "users read own requests or admins read all" on public.time_off_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );
