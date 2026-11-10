-- Read-only, before migration 035. Only container-only people need an explicit leaf-team choice first.
with containers as (
  select d.id from public.departments d where lower(regexp_replace(d.name,'[^a-zA-Z]','','g'))='videounit'
    or exists(select 1 from public.departments c where c.parent_department_id=d.id)
), memberships as (
  select id profile_id,department_id from public.employee_profiles where department_id is not null
  union select profile_id,department_id from public.employee_profile_departments
)
select p.id profile_id,p.full_name,
  case when exists(select 1 from memberships m where m.profile_id=p.id and not exists(select 1 from containers c where c.id=m.department_id))
    then 'Ready: redundant container membership will be removed; existing teams stay'
    else 'Choose Video Edit, Motion Graphics, or both in the current profile editor before applying 035' end as next_step
from public.employee_profiles p
where exists(select 1 from memberships m join containers c on c.id=m.department_id where m.profile_id=p.id)
order by p.full_name;
