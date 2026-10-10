select
  to_regclass('public.profile_claim_reservations') is not null as reservation_table_exists,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.profile_claim_reservations')
  ), false) as row_level_security_enabled;

select
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'reserve_profile_for_current_user'
      and pg_proc.prosecdef
  ) as reservation_rpc_is_security_definer,
  has_function_privilege('authenticated', 'public.reserve_profile_for_current_user()', 'execute') as authenticated_can_reserve,
  not has_function_privilege('anon', 'public.reserve_profile_for_current_user()', 'execute') as anonymous_cannot_reserve;

select
  count(*) filter (where profiles.id is null) as missing_profiles,
  count(*) filter (where users.id is null) as missing_auth_users,
  count(*) filter (where profiles.user_id is not null) as reservations_with_active_profile_access,
  count(*) - count(distinct reservations.profile_id) as duplicate_profile_reservations
from public.profile_claim_reservations as reservations
left join public.employee_profiles as profiles on profiles.id = reservations.profile_id
left join auth.users as users on users.id = reservations.user_id;
