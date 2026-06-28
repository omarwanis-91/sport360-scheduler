alter table public.departments
  add column if not exists parent_department_id uuid references public.departments(id) on delete set null;

alter table public.departments
  drop constraint if exists departments_parent_not_self;

alter table public.departments
  add constraint departments_parent_not_self
  check (parent_department_id is null or parent_department_id <> id);

select pg_notify('pgrst', 'reload schema');
