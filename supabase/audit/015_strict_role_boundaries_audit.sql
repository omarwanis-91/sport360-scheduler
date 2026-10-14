with expected_policies(table_name, policy_name) as (
  values
    ('departments', 'role scoped departments read'),
    ('employee_profiles', 'role scoped profiles read'),
    ('employee_profile_departments', 'role scoped profile departments read'),
    ('rotation_versions', 'role scoped rotations read'),
    ('schedule_overrides', 'role scoped schedule overrides read'),
    ('department_daily_leads', 'role scoped daily leads read'),
    ('department_lead_rotation_versions', 'role scoped lead rotations read'),
    ('vacation_requests', 'vacation visible to owner lead or admin')
)
select
  'role scoped read policies' as check_name,
  count(*) = (select count(*) from expected_policies) as passed,
  count(*)::text || '/' || (select count(*) from expected_policies)::text as detail
from expected_policies expected
join pg_policies policy
  on policy.schemaname = 'public'
 and policy.tablename = expected.table_name
 and policy.policyname = expected.policy_name;

select
  'onboarding photo read scope' as check_name,
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'users read own onboarding photos'
      and qual ilike '%current_user_can_read_profile%'
  ) as passed,
  'Approved onboarding photos follow profile visibility' as detail;

select
  'sole Admin index' as check_name,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_roles'
      and indexname = 'user_roles_single_admin'
  ) as passed,
  coalesce((
    select indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_roles'
      and indexname = 'user_roles_single_admin'
  ), 'missing') as detail;

with expected_functions(function_name, definition_fragment) as (
  values
    ('current_user_can_access_department', 'profile_directly_belongs_to_department'),
    ('current_user_can_manage_department', 'current_role() = ''lead'''),
    ('current_user_can_read_profile', 'profile_is_unassigned'),
    ('current_user_can_manage_profile', 'target_membership'),
    ('update_own_profile', 'photo_url = nullif'),
    ('update_profile_hierarchy', 'profile.hierarchy_updated'),
    ('add_profile_to_department', 'Leads can add only currently unassigned profiles'),
    ('remove_profile_from_department', 'Leads cannot remove their own department access'),
    ('set_user_access_role', 'sole Admin role cannot be assigned'),
    ('unlink_profile_account', 'sole Admin account cannot be unlinked'),
    ('delete_admin_profile', 'sole Admin profile cannot be deleted')
)
select
  expected.function_name as check_name,
  count(procedure.oid) > 0 as passed,
  case when count(procedure.oid) > 0 then 'present' else 'missing expected definition' end as detail
from expected_functions expected
left join pg_proc procedure
  on procedure.pronamespace = 'public'::regnamespace
 and procedure.proname = expected.function_name
 and pg_get_functiondef(procedure.oid) ilike '%' || expected.definition_fragment || '%'
group by expected.function_name
order by expected.function_name;

select
  'legacy own-profile call keeps title locked' as check_name,
  exists (
    select 1
    from pg_proc procedure
    where procedure.pronamespace = 'public'::regnamespace
      and procedure.proname = 'update_own_profile'
      and procedure.pronargs = 4
      and pg_get_functiondef(procedure.oid) ilike '%from public.update_own_profile(p_profile_id, p_full_name, p_photo_url)%'
  ) as passed,
  'Four-argument clients delegate to the name/photo-only function' as detail;

select
  'Admin count' as check_name,
  count(*) = 1 as passed,
  count(*)::text || ' Admin role row' as detail
from public.user_roles
where role = 'admin';

select
  'no direct browser role mutation policy' as check_name,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_roles'
      and policyname = 'admins manage roles'
  ) as passed,
  'Role changes must use set_user_access_role' as detail;
