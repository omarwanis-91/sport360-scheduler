select
  to_regclass('public.profile_onboarding_submissions') is not null as onboarding_table_exists,
  coalesce((select relrowsecurity from pg_class where oid = 'public.profile_onboarding_submissions'::regclass), false) as onboarding_rls_enabled,
  exists (select 1 from storage.buckets where id = 'profile-onboarding-photos' and public = false) as onboarding_bucket_private,
  has_function_privilege('authenticated', 'public.get_my_profile_onboarding()', 'execute') as users_can_read_own_submission,
  has_function_privilege('authenticated', 'public.save_my_profile_onboarding(text,text)', 'execute') as users_can_save_submission,
  has_function_privilege('authenticated', 'public.list_profile_onboarding()', 'execute') as admin_list_rpc_available,
  has_function_privilege('authenticated', 'public.approve_profile_onboarding(uuid,uuid)', 'execute') as admin_approval_rpc_available,
  not has_function_privilege('anon', 'public.save_my_profile_onboarding(text,text)', 'execute') as anonymous_cannot_submit,
  not has_function_privilege('authenticated', 'public.reserve_profile_for_current_user()', 'execute') as legacy_reservation_disabled;

select
  count(*) filter (where status = 'pending') as pending_submissions,
  count(*) filter (where status = 'approved') as approved_submissions,
  count(*) filter (where status = 'approved' and linked_profile_id is null) as invalid_approved_without_profile
from public.profile_onboarding_submissions;

select
  pg_get_functiondef('public.claim_profile_for_current_user()'::regprocedure) not ilike '%lower(email)%' as email_auto_claim_disabled,
  pg_get_functiondef('public.claim_profile_for_current_user()'::regprocedure) ilike '%waiting for Admin approval%' as admin_approval_required;
