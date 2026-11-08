with definition as (
  select pg_get_functiondef('public.save_rotation_drafts(uuid,jsonb)'::regprocedure) body
)
select 'Later versions require explicit review' check_name,
  body like '%Later versions exist. Review their dates before saving%' passed from definition
union all select 'Reviewed versions checked under locks', body like '%Later versions changed%'
  and body like '%expectedFuture%' and body like '%order by profile.id for update%' from definition
union all select 'Apply onward is scoped and audited', body like '%rotation.future_replaced%'
  and body like '%profile_id = target_id and effective_start > start_date%'
  and body like '%sourceVersionId%' from definition
union all select 'Later Lead choices merged without resetting other departments', body like '%lead.department_id = p_department_id and lead.effective_start >= start_date%'
  and body like '%lead.pattern->>day_index = target_id::text%' from definition
union all select 'Authenticated scoped save grants',
  has_function_privilege('authenticated', 'public.save_rotation_drafts(uuid,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.save_rotation_drafts(uuid,jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.save_reviewed_rotation_drafts(uuid,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.save_reviewed_rotation_drafts(uuid,jsonb)', 'execute');
