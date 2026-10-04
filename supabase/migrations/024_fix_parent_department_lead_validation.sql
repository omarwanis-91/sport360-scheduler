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
    if not public.profile_belongs_to_department(profile_id, new.department_id) then
      raise exception 'Lead profile % is not assigned within the selected department scope', profile_id;
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
  if not public.profile_belongs_to_department(new.lead_profile_id, new.department_id) then
    raise exception 'Daily lead must be assigned within the selected department scope';
  end if;
  return new;
end;
$$;

select pg_notify('pgrst', 'reload schema');
