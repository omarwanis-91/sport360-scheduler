create table if not exists public.profile_onboarding_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  linked_profile_id uuid unique references public.employee_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_onboarding_submissions enable row level security;

drop policy if exists "users read own onboarding submission" on public.profile_onboarding_submissions;
create policy "users read own onboarding submission"
on public.profile_onboarding_submissions
for select to authenticated
using (user_id = auth.uid() or public.current_role() = 'admin');

revoke all on table public.profile_onboarding_submissions from public, anon;
grant select on table public.profile_onboarding_submissions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-onboarding-photos',
  'profile-onboarding-photos',
  false,
  750000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users read own onboarding photos" on storage.objects;
create policy "users read own onboarding photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-onboarding-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() = 'admin'
    or (
      public.is_claimed_user()
      and exists (
        select 1
        from public.employee_profiles profiles
        where profiles.photo_url = 'storage:profile-onboarding-photos/' || storage.objects.name
      )
    )
  )
);

drop policy if exists "users upload own onboarding photos" on storage.objects;
create policy "users upload own onboarding photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-onboarding-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own onboarding photos" on storage.objects;
create policy "users update own onboarding photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-onboarding-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-onboarding-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own onboarding photos" on storage.objects;
create policy "users delete own onboarding photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-onboarding-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.get_my_profile_onboarding()
returns table (
  user_id uuid,
  email text,
  full_name text,
  photo_url text,
  status text,
  linked_profile_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    users.id,
    users.email::text,
    submissions.full_name,
    submissions.photo_url,
    submissions.status,
    submissions.linked_profile_id,
    submissions.created_at,
    submissions.updated_at
  from auth.users as users
  left join public.profile_onboarding_submissions as submissions on submissions.user_id = users.id
  where users.id = auth.uid();
$$;

create or replace function public.save_my_profile_onboarding(
  p_full_name text,
  p_photo_url text default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  photo_url text,
  status text,
  linked_profile_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(p_full_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(clean_name) < 2 or char_length(clean_name) > 120 then
    raise exception 'Name must be between 2 and 120 characters';
  end if;

  if p_photo_url is not null
    and p_photo_url <> ''
    and p_photo_url not like 'storage:profile-onboarding-photos/' || auth.uid()::text || '/%'
  then
    raise exception 'Invalid onboarding photo reference';
  end if;

  if exists (
    select 1 from public.profile_onboarding_submissions
    where profile_onboarding_submissions.user_id = auth.uid()
      and profile_onboarding_submissions.status = 'approved'
  ) then
    raise exception 'This profile has already been approved';
  end if;

  insert into public.profile_onboarding_submissions (user_id, full_name, photo_url)
  values (auth.uid(), clean_name, nullif(p_photo_url, ''))
  on conflict on constraint profile_onboarding_submissions_pkey do update set
    full_name = excluded.full_name,
    photo_url = excluded.photo_url,
    updated_at = now();

  return query select * from public.get_my_profile_onboarding();
end;
$$;

create or replace function public.list_profile_onboarding()
returns table (
  user_id uuid,
  email text,
  full_name text,
  photo_url text,
  status text,
  linked_profile_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;

  return query
  select
    users.id,
    users.email::text,
    submissions.full_name,
    submissions.photo_url,
    submissions.status,
    submissions.linked_profile_id,
    submissions.created_at,
    submissions.updated_at
  from public.profile_onboarding_submissions as submissions
  join auth.users as users on users.id = submissions.user_id
  order by submissions.created_at asc;
end;
$$;

create or replace function public.approve_profile_onboarding(
  p_user_id uuid,
  p_profile_id uuid default null
)
returns public.employee_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  submission public.profile_onboarding_submissions%rowtype;
  account_email text;
  target_profile public.employee_profiles%rowtype;
  generated_code text;
begin
  if public.current_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;

  select * into submission
  from public.profile_onboarding_submissions
  where user_id = p_user_id
  for update;

  if submission.user_id is null then
    raise exception 'Onboarding submission not found';
  end if;

  if submission.status = 'approved' then
    raise exception 'This onboarding submission is already approved';
  end if;

  select users.email::text into account_email
  from auth.users as users
  where users.id = p_user_id;

  if account_email is null then
    raise exception 'The account does not have an email address';
  end if;

  if exists (
    select 1 from public.employee_profiles
    where lower(email) = lower(account_email)
      and id is distinct from p_profile_id
  ) then
    raise exception 'Another employee profile already uses this account email; link that profile or change its email first';
  end if;

  if p_profile_id is null then
    generated_code := 'ONB-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 10));

    insert into public.employee_profiles (
      user_id,
      department_id,
      employee_code,
      email,
      full_name,
      title,
      photo_url,
      yearly_vacation_days,
      remaining_vacation_days
    ) values (
      p_user_id,
      null,
      generated_code,
      account_email,
      submission.full_name,
      'Pending assignment',
      submission.photo_url,
      21,
      21
    )
    returning * into target_profile;
  else
    select * into target_profile
    from public.employee_profiles
    where id = p_profile_id
    for update;

    if target_profile.id is null then
      raise exception 'Employee profile not found';
    end if;

    if target_profile.user_id is not null then
      raise exception 'That employee profile is already linked to an account';
    end if;

    update public.employee_profiles
    set
      user_id = p_user_id,
      email = account_email,
      full_name = submission.full_name,
      photo_url = submission.photo_url,
      updated_at = now()
    where id = p_profile_id
    returning * into target_profile;
  end if;

  insert into public.user_roles (user_id, role)
  values (p_user_id, 'employee')
  on conflict (user_id) do update set role = 'employee';

  update public.profile_onboarding_submissions
  set
    status = 'approved',
    linked_profile_id = target_profile.id,
    updated_at = now()
  where user_id = p_user_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'profile.onboarding_approved',
    'profile',
    target_profile.id::text,
    jsonb_build_object('user_id', p_user_id, 'email', account_email)
  );

  return target_profile;
end;
$$;

create or replace function public.claim_profile_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into claimed_profile_id
  from public.employee_profiles
  where user_id = auth.uid();

  if claimed_profile_id is null then
    raise exception 'Profile access is waiting for Admin approval';
  end if;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'employee')
  on conflict (user_id) do nothing;

  return claimed_profile_id;
end;
$$;

revoke all on function public.get_my_profile_onboarding() from public, anon;
revoke all on function public.save_my_profile_onboarding(text, text) from public, anon;
revoke all on function public.list_profile_onboarding() from public, anon;
revoke all on function public.approve_profile_onboarding(uuid, uuid) from public, anon;
revoke all on function public.reserve_profile_for_current_user() from authenticated;
revoke all on function public.claim_profile_for_current_user() from public, anon;

grant execute on function public.get_my_profile_onboarding() to authenticated;
grant execute on function public.save_my_profile_onboarding(text, text) to authenticated;
grant execute on function public.list_profile_onboarding() to authenticated;
grant execute on function public.approve_profile_onboarding(uuid, uuid) to authenticated;
grant execute on function public.claim_profile_for_current_user() to authenticated;

select pg_notify('pgrst', 'reload schema');
