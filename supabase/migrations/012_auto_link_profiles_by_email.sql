-- Auto-link auth profiles to staff profiles by matching email addresses.
-- This supports the "person.email is the source of truth" onboarding flow.

create or replace function public.link_profile_by_email()
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  current_email text;
  matched_person_id uuid;
  match_count integer;
begin
  select lower(nullif(trim(email), ''))
  into current_email
  from public.profiles
  where id = auth.uid();

  if current_email is null then
    return null;
  end if;

  select count(*), min(id)
  into match_count, matched_person_id
  from public.people
  where active = true
    and lower(nullif(trim(email), '')) = current_email;

  -- Refuse ambiguous matches. Admin can resolve duplicate emails manually.
  if match_count <> 1 then
    return null;
  end if;

  update public.profiles
  set person_id = matched_person_id
  where id = auth.uid()
    and (person_id is null or person_id = matched_person_id);

  return matched_person_id;
end;
$function$;

drop function if exists public.admin_add_person(text, text, uuid, integer, integer, text, text, text);
create function public.admin_add_person(
  p_name text,
  p_title text,
  p_department_id uuid,
  p_vacation_limit integer,
  p_display_order integer,
  p_default_shift_type_id text,
  p_email text default null,
  p_picture_url text default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  new_person_id uuid;
  normalized_email text;
begin
  perform public.assert_admin();

  if nullif(trim(p_name), '') is null then
    raise exception 'Name is required' using errcode = '22023';
  end if;

  normalized_email := lower(nullif(trim(coalesce(p_email, '')), ''));

  insert into public.people (
    name,
    title,
    department_id,
    vacation_limit,
    display_order,
    email,
    picture_url
  )
  values (
    trim(p_name),
    coalesce(nullif(trim(p_title), ''), 'Team Member'),
    p_department_id,
    greatest(coalesce(p_vacation_limit, 15), 0),
    coalesce(p_display_order, 0),
    normalized_email,
    nullif(trim(coalesce(p_picture_url, '')), '')
  )
  returning id into new_person_id;

  insert into public.person_defaults (person_id, weekday, shift_type_id)
  select
    new_person_id,
    weekday,
    case when weekday in (5, 6) then 'weekend' else p_default_shift_type_id end
  from generate_series(0, 6) as weekday;

  if normalized_email is not null then
    update public.profiles
    set person_id = new_person_id
    where lower(nullif(trim(email), '')) = normalized_email
      and person_id is null;
  end if;

  return new_person_id;
end;
$function$;

grant execute on function public.link_profile_by_email() to authenticated;
grant execute on function public.admin_add_person(text, text, uuid, integer, integer, text, text, text) to authenticated;
