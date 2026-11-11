export function isDepartmentContainer(state, departmentId) {
  return state.departments.some(d=>d.id===departmentId&&(d.isContainer||d.name.toLowerCase().replace(/[^a-z]/g,'')==='videounit'))
    || state.departments.some(d=>d.parentDepartmentId===departmentId);
}

export function assignableDepartments(state) {
  return state.departments.filter(d=>!isDepartmentContainer(state,d.id));
}

export function profileTeamIds(state, profile) {
  return [...new Set([profile?.departmentId,...(profile?.departmentIds||[])].filter(Boolean))]
    .filter(id=>!isDepartmentContainer(state,id));
}

export function derivedProfileTitle(state, profile) {
  const ids=new Set(profileTeamIds(state,profile));
  const names=state.departments.filter(d=>ids.has(d.id)).map(d=>d.name.toLowerCase().replace(/[^a-z]/g,''));
  const video=names.includes('videoedit'),motion=names.includes('motiongraphics')||names.includes('motion');
  const position=['manager','lead'].includes(profile?.seniorityLevel)?profile.seniorityLevel:'artist';
  if(video&&motion)return {artist:'Hybrid Artist',lead:'Lead Hybrid',manager:'Head of Video Unit'}[position];
  if(video)return {artist:'Video Editor',lead:'Lead Video Editor',manager:'Head of Video Team'}[position];
  if(motion)return {artist:'Motion Graphics',lead:'Lead Motion Graphics',manager:'Head of Motion Graphics'}[position];
  return {artist:'Artist',lead:'Lead',manager:'Manager'}[position];
}

export function normalizeDemoProfileStructure(state) {
  for(const profile of state.profiles) {
    const teams=profileTeamIds(state,profile);
    profile.departmentIds=teams;profile.departmentId=teams[0]||null;
    profile.title=derivedProfileTitle(state,profile);
  }
  return state;
}
