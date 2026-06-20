alter table public.departments
  add column if not exists min_available_people integer not null default 1
  check (min_available_people >= 0);
