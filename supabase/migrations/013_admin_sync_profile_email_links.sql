-- Admin utility to link all unlinked auth profiles to people by exact email match.
-- It only links unambiguous matches: one active person per email.

create or replace function public.admin_sync_profile_email_links()
returns integer
language plpgsql
security definer
set search_path to public
as $function$
declare
  linked_count integer;
begin
  perform public.assert_admin();

  with email_matches as (
    select
      lower(nullif(trim(email), '')) as email,
      min(id) as person_id,
      count(*) as person_count
    from public.people
    where active = true
      and nullif(trim(email), '') is not null
    group by lower(nullif(trim(email), ''))
  ),
  updated_profiles as (
    update public.profiles
    set person_id = email_matches.person_id
    from email_matches
    where profiles.person_id is null
      and lower(nullif(trim(profiles.email), '')) = email_matches.email
      and email_matches.person_count = 1
    returning profiles.id
  )
  select count(*) into linked_count
  from updated_profiles;

  return linked_count;
end;
$function$;

grant execute on function public.admin_sync_profile_email_links() to authenticated;
