-- Read-only audit for the private profile photo bucket and policies.

with checks as (
  select
    'bucket'::text as audit_area,
    'profile-photos exists'::text as check_name,
    case when exists (
      select 1 from storage.buckets where id = 'profile-photos'
    ) then 'pass' else 'fail' end as audit_status,
    coalesce((
      select 'public=' || public::text || ', limit=' || file_size_limit::text
      from storage.buckets where id = 'profile-photos'
    ), 'bucket missing') as details

  union all

  select
    'bucket',
    'profile-photos is private',
    case when exists (
      select 1 from storage.buckets where id = 'profile-photos' and public = false
    ) then 'pass' else 'fail' end,
    'public access must remain disabled'

  union all

  select
    'bucket',
    'size limit is 750 KB',
    case when exists (
      select 1 from storage.buckets where id = 'profile-photos' and file_size_limit = 750000
    ) then 'pass' else 'fail' end,
    coalesce((select file_size_limit::text from storage.buckets where id = 'profile-photos'), 'missing')

  union all

  select
    'policy',
    expected.policy_name,
    case when exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'storage'
        and policy.tablename = 'objects'
        and policy.policyname = expected.policy_name
        and policy.roles @> array['authenticated']::name[]
        and policy.cmd = expected.command
    ) then 'pass' else 'fail' end,
    expected.command || ' policy for authenticated'
  from (
    values
      ('claimed users read profile photos'::text, 'SELECT'::text),
      ('admins and owners upload profile photos'::text, 'INSERT'::text),
      ('admins and owners update profile photos'::text, 'UPDATE'::text),
      ('admins and owners delete profile photos'::text, 'DELETE'::text)
  ) expected(policy_name, command)

  union all

  select
    'data',
    'profile photo references',
    'pass',
    'storage=' || count(*) filter (where photo_url like 'storage:profile-photos/%')::text
      || ', legacy=' || count(*) filter (where photo_url is not null and photo_url not like 'storage:profile-photos/%')::text
  from public.employee_profiles
)
select audit_area, check_name, audit_status, details
from checks
order by case audit_status when 'fail' then 1 else 2 end, audit_area, check_name;

