insert into public.departments (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Operations'),
  ('22222222-2222-2222-2222-222222222222', 'Customer Support'),
  ('33333333-3333-3333-3333-333333333333', 'Field Team')
on conflict (id) do nothing;

insert into public.employee_profiles (
  id,
  department_id,
  employee_code,
  email,
  full_name,
  title,
  yearly_vacation_days,
  remaining_vacation_days
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'SCH-001', 'admin@company.test', 'Omar Wanis', 'Workforce Admin', 24, 22),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'SCH-014', 'mona@company.test', 'Mona Saleh', 'Department Lead', 24, 19),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'SCH-018', 'karim@company.test', 'Karim Adel', 'Scheduler', 21, 16),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '22222222-2222-2222-2222-222222222222', 'SCH-022', 'youssef@company.test', 'Youssef Nabil', 'Agent', 21, 18),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '33333333-3333-3333-3333-333333333333', 'SCH-031', 'layla@company.test', 'Layla Hassan', 'Field Specialist', 21, 21)
on conflict (id) do nothing;

insert into public.rotation_versions (id, profile_id, effective_start, pattern) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2026-05-01', array['morning', 'morning', 'night', 'night', 'morning', 'weekend', 'weekend']),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '2026-05-01', array['morning', 'morning', 'morning', 'midday', 'night', 'night', 'weekend']),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '2026-05-01', array['night', 'night', 'weekend', 'morning', 'morning', 'weekend', 'weekend']),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '2026-05-01', array['morning', 'weekend', 'night', 'night', 'weekend', 'morning', 'weekend']),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '2026-05-01', array['ground', 'ground', 'weekend', 'morning', 'night', 'weekend', 'weekend'])
on conflict (id) do nothing;

insert into public.schedule_overrides (id, profile_id, shift_date, status_id, note) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '2026-05-20', 'midday', 'Ramadan pilot shift'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '2026-05-18', 'sick', 'Medical leave')
on conflict (profile_id, shift_date) do nothing;

insert into public.department_daily_leads (id, department_id, lead_date, lead_profile_id) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', '11111111-1111-1111-1111-111111111111', '2026-05-16', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', '22222222-2222-2222-2222-222222222222', '2026-05-16', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', '33333333-3333-3333-3333-333333333333', '2026-05-16', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5')
on conflict (department_id, lead_date) do nothing;

insert into public.vacation_requests (id, profile_id, start_date, end_date, reason, status, deducted_days) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '2026-05-22', '2026-05-24', 'Family travel', 'pending', 0)
on conflict (id) do nothing;
