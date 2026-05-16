-- Extend admin_add_person to create profile fields in one call.

drop function if exists public.admin_add_person(text, text, uuid, integer, integer, text);
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
begin
  perform public.assert_admin();

  if nullif(trim(p_name), '') is null then
    raise exception 'Name is required' using errcode = '22023';
  end if;

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
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_picture_url, '')), '')
  )
  returning id into new_person_id;

  insert into public.person_defaults (person_id, weekday, shift_type_id)
  select
    new_person_id,
    weekday,
    case when weekday in (5, 6) then 'weekend' else p_default_shift_type_id end
  from generate_series(0, 6) as weekday;

  return new_person_id;
end;
$function$;

grant execute on function public.admin_add_person(text, text, uuid, integer, integer, text, text, text) to authenticated;
