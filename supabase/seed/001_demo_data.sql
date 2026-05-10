insert into public.shift_types (id, label, color, counts_as_vacation, counts_as_sick, default_eligible, display_order) values
  ('morning', 'Morning', '#6f927b', false, false, true, 10),
  ('night', 'Night', '#9b8b56', false, false, true, 20),
  ('weekend', 'Weekend', '#8b3327', false, false, true, 30),
  ('vacation', 'Vacation', '#586170', true, false, false, 40),
  ('sick', 'Sick Leave', '#7c5367', false, true, false, 50),
  ('ground', 'On Ground', '#426f9a', false, false, false, 60)
on conflict (id) do update set
  label = excluded.label,
  color = excluded.color,
  counts_as_vacation = excluded.counts_as_vacation,
  counts_as_sick = excluded.counts_as_sick,
  default_eligible = excluded.default_eligible,
  display_order = excluded.display_order,
  active = true;

insert into public.departments (name, color, manager_enabled, display_order) values
  ('Video Edit', '#7aa2d6', true, 10),
  ('Motion Graphics', '#7b5aa8', true, 20),
  ('Hybrid', '#3f8f87', false, 30)
on conflict (name) do update set
  color = excluded.color,
  manager_enabled = excluded.manager_enabled,
  display_order = excluded.display_order,
  active = true;

with demo_people(name, title, department, display_order) as (
  values
    ('Yasir Abdelgill', 'Lead Editor', 'Video Edit', 10),
    ('Ahmed Sorour', 'Senior Editor', 'Motion Graphics', 20),
    ('Abdelrhman Medhat', 'Video Editor', 'Hybrid', 30),
    ('Rawan', 'Assistant Editor', 'Video Edit', 40),
    ('Namir', 'Motion Designer', 'Motion Graphics', 50),
    ('Mohamed Moawad', 'Compositor', 'Hybrid', 60),
    ('Sherif Ghemizy', 'Lead Editor', 'Video Edit', 70),
    ('Mohamed Mado', 'Senior Editor', 'Motion Graphics', 80)
)
insert into public.people (name, title, department_id, vacation_limit, display_order)
select demo_people.name, demo_people.title, departments.id, 15, demo_people.display_order
from demo_people
join public.departments on departments.name = demo_people.department
where not exists (select 1 from public.people where people.name = demo_people.name);

insert into public.person_defaults (person_id, weekday, shift_type_id)
select people.id, weekday.day,
  case
    when weekday.day in (5, 6) then 'weekend'
    when ((row_number() over (order by people.display_order) - 1 + weekday.day) % 9 = 0) then 'night'
    else 'morning'
  end
from public.people
cross join generate_series(0, 6) as weekday(day)
on conflict (person_id, weekday) do nothing;

insert into public.manager_defaults (department_id, weekday, person_id)
select departments.id, weekday.day, null
from public.departments
cross join generate_series(0, 6) as weekday(day)
where departments.manager_enabled = true
on conflict (department_id, weekday) do nothing;
