-- Person profile fields used by the app profile page.

alter table public.people
  add column if not exists email text,
  add column if not exists picture_url text;

update public.people
set email = profiles.email
from public.profiles
where profiles.person_id = people.id
  and coalesce(people.email, '') = '';

drop function if exists public.admin_update_person(uuid, text, text, uuid, integer, boolean);
create function public.admin_update_person(
  p_person_id uuid,
  p_name text default null,
  p_title text default null,
  p_department_id uuid default null,
  p_vacation_limit integer default null,
  p_active boolean default null,
  p_email text default null,
  p_picture_url text default null
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
begin
  perform public.assert_admin();

  update public.people
  set
    name = case when p_name is null then name else coalesce(nullif(trim(p_name), ''), name) end,
    title = case when p_title is null then title else coalesce(nullif(trim(p_title), ''), title) end,
    department_id = coalesce(p_department_id, department_id),
    vacation_limit = coalesce(greatest(p_vacation_limit, 0), vacation_limit),
    active = coalesce(p_active, active),
    email = case when p_email is null then email else nullif(trim(p_email), '') end,
    picture_url = case when p_picture_url is null then picture_url else nullif(trim(p_picture_url), '') end
  where id = p_person_id;
end;
$function$;

grant execute on function public.admin_update_person(uuid, text, text, uuid, integer, boolean, text, text) to authenticated;
