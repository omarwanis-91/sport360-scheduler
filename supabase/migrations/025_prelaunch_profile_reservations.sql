create table if not exists public.profile_claim_reservations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null unique references public.employee_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profile_claim_reservations enable row level security;

drop policy if exists "users read own profile reservation" on public.profile_claim_reservations;
create policy "users read own profile reservation"
on public.profile_claim_reservations
for select to authenticated
using (user_id = auth.uid() or public.current_role() = 'admin');

revoke all on table public.profile_claim_reservations from public, anon;
grant select on table public.profile_claim_reservations to authenticated;

create or replace function public.reserve_profile_for_current_user()
returns table (
  profile_id uuid,
  full_name text,
  email text,
  title text,
  reserved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  account_email text;
  target_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select users.email into account_email
  from auth.users as users
  where users.id = auth.uid();

  if account_email is null then
    raise exception 'This account does not have an email address';
  end if;

  select reservations.profile_id into target_profile_id
  from public.profile_claim_reservations as reservations
  join public.employee_profiles as profiles on profiles.id = reservations.profile_id
  where reservations.user_id = auth.uid()
    and lower(profiles.email) = lower(account_email)
    and profiles.user_id is null;

  if target_profile_id is null then
    delete from public.profile_claim_reservations
    where user_id = auth.uid();
  end if;

  if target_profile_id is null then
    select profiles.id into target_profile_id
    from public.employee_profiles as profiles
    where lower(profiles.email) = lower(account_email)
      and profiles.user_id is null
    order by profiles.created_at asc
    limit 1;
  end if;

  if target_profile_id is null then
    raise exception 'No employee profile matches this work email';
  end if;

  if exists (
    select 1
    from public.profile_claim_reservations as reservations
    where reservations.profile_id = target_profile_id
      and reservations.user_id <> auth.uid()
  ) then
    raise exception 'This employee profile has already been reserved';
  end if;

  insert into public.profile_claim_reservations (user_id, profile_id)
  values (auth.uid(), target_profile_id)
  on conflict (user_id) do nothing;

  return query
  select
    profiles.id,
    profiles.full_name,
    profiles.email,
    profiles.title,
    reservations.created_at
  from public.profile_claim_reservations as reservations
  join public.employee_profiles as profiles on profiles.id = reservations.profile_id
  where reservations.user_id = auth.uid();
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
  reserved_profile_id uuid;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select users.email into account_email
  from auth.users as users
  where users.id = auth.uid();

  select id into claimed_profile_id
  from public.employee_profiles
  where user_id = auth.uid();

  if claimed_profile_id is null then
    select reservations.profile_id into reserved_profile_id
    from public.profile_claim_reservations as reservations
    where reservations.user_id = auth.uid();

    if reserved_profile_id is not null then
      update public.employee_profiles
      set user_id = auth.uid(), updated_at = now()
      where id = reserved_profile_id
        and user_id is null
        and lower(email) = lower(account_email)
      returning id into claimed_profile_id;
    end if;
  end if;

  if claimed_profile_id is null then
    update public.employee_profiles
    set user_id = auth.uid(), updated_at = now()
    where user_id is null
      and lower(email) = lower(account_email)
    returning id into claimed_profile_id;
  end if;

  if claimed_profile_id is null then
    raise exception 'No employee profile matches this account';
  end if;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), 'employee')
  on conflict (user_id) do nothing;

  delete from public.profile_claim_reservations
  where user_id = auth.uid();

  return claimed_profile_id;
end;
$$;

revoke all on function public.reserve_profile_for_current_user() from public, anon;
grant execute on function public.reserve_profile_for_current_user() to authenticated;

select pg_notify('pgrst', 'reload schema');
