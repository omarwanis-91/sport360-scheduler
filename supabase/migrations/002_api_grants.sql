grant usage on schema public to anon, authenticated;

grant select on public.departments to authenticated;
grant select on public.shift_types to authenticated;
grant select on public.people to authenticated;
grant select on public.profiles to authenticated;
grant select on public.person_defaults to authenticated;
grant select on public.schedule_overrides to authenticated;
grant select on public.manager_defaults to authenticated;
grant select on public.manager_overrides to authenticated;
grant select, insert on public.time_off_requests to authenticated;

grant insert, update, delete on public.departments to authenticated;
grant insert, update, delete on public.shift_types to authenticated;
grant insert, update, delete on public.people to authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.person_defaults to authenticated;
grant insert, update, delete on public.schedule_overrides to authenticated;
grant insert, update, delete on public.manager_defaults to authenticated;
grant insert, update, delete on public.manager_overrides to authenticated;
grant update on public.time_off_requests to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_person(uuid) to authenticated;
