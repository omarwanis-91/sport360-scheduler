-- Fix UUID aggregation in email linking and add profile picture storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "signed in users read profile pictures" on storage.objects;
create policy "signed in users read profile pictures" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-pictures');

drop policy if exists "admins upload profile pictures" on storage.objects;
create policy "admins upload profile pictures" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.person_id::text = (storage.foldername(name))[2]
      )
    )
  );

drop policy if exists "admins update profile pictures" on storage.objects;
create policy "admins update profile pictures" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.person_id::text = (storage.foldername(name))[2]
      )
    )
  )
  with check (
    bucket_id = 'profile-pictures'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.person_id::text = (storage.foldername(name))[2]
      )
    )
  );

drop policy if exists "admins delete profile pictures" on storage.objects;
create policy "admins delete profile pictures" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.person_id::text = (storage.foldername(name))[2]
      )
    )
  );

create or replace function public.set_profile_picture(
  p_person_id uuid,
  p_picture_url text
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.person_id = p_person_id
    )
  ) then
    raise exception 'Profile picture access denied' using errcode = '42501';
  end if;

  update public.people
  set picture_url = nullif(trim(p_picture_url), '')
  where id = p_person_id;
end;
$function$;

grant execute on function public.set_profile_picture(uuid, text) to authenticated;

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

  select count(*)
  into match_count
  from public.people
  where active = true
    and lower(nullif(trim(email), '')) = current_email;

  if match_count <> 1 then
    return null;
  end if;

  select id
  into matched_person_id
  from public.people
  where active = true
    and lower(nullif(trim(email), '')) = current_email
  limit 1;

  update public.profiles
  set person_id = matched_person_id
  where id = auth.uid()
    and (person_id is null or person_id = matched_person_id);

  return matched_person_id;
end;
$function$;

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

  with email_counts as (
    select
      lower(nullif(trim(email), '')) as email,
      count(*) as person_count
    from public.people
    where active = true
      and nullif(trim(email), '') is not null
    group by lower(nullif(trim(email), ''))
  ),
  unique_matches as (
    select
      email_counts.email,
      people.id as person_id
    from email_counts
    join public.people
      on people.active = true
      and lower(nullif(trim(people.email), '')) = email_counts.email
    where email_counts.person_count = 1
  ),
  updated_profiles as (
    update public.profiles
    set person_id = unique_matches.person_id
    from unique_matches
    where profiles.person_id is null
      and lower(nullif(trim(profiles.email), '')) = unique_matches.email
    returning profiles.id
  )
  select count(*) into linked_count
  from updated_profiles;

  return linked_count;
end;
$function$;

grant execute on function public.link_profile_by_email() to authenticated;
grant execute on function public.admin_sync_profile_email_links() to authenticated;
