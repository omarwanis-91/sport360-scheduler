-- Replace these values if you want to test a different person/date.
-- This diagnostic is meant to be run in Supabase SQL Editor.

select
  auth.uid() as sql_editor_auth_uid,
  'SQL Editor auth.uid() is expected to be null; browser RPC calls have a user id.' as note;

select id, email, role, person_id
from public.profiles
where email = 'omarwanis@sport360.com';

select routine_name, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'assert_admin',
    'admin_upsert_schedule_override',
    'admin_delete_schedule_override',
    'admin_upsert_person_default',
    'admin_upsert_manager_default',
    'admin_upsert_manager_override'
  )
order by routine_name;

select
  people.id as person_id,
  people.name,
  departments.name as department
from public.people
left join public.departments on departments.id = people.department_id
where people.active = true
order by people.display_order
limit 5;

select *
from public.schedule_overrides
order by created_at desc
limit 20;
