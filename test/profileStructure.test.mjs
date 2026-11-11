import test from 'node:test';
import assert from 'node:assert/strict';
import { derivedProfileTitle,assignableDepartments,profileTeamIds,normalizeDemoProfileStructure } from '../src/profileStructure.mjs';
const departments=[{id:'unit',name:'Video Unit'},{id:'edit',name:'Video Edit',parentDepartmentId:'unit'},{id:'motion',name:'Motion Graphics',parentDepartmentId:'unit'}];
test('all nine team/position titles match the agreed names',()=>{
  const expected={artist:['Video Editor','Motion Graphics','Hybrid Artist'],lead:['Lead Video Editor','Lead Motion Graphics','Lead Hybrid'],manager:['Head of Video Team','Head of Motion Graphics','Head of Video Unit']};
  for(const [seniorityLevel,titles] of Object.entries(expected)) {
    [['edit'],['motion'],['edit','motion']].forEach((departmentIds,i)=>assert.equal(derivedProfileTitle({departments},{departmentIds,seniorityLevel}),titles[i]));
  }
});
test('containers cannot become person teams or affect a derived title; legacy anchor and membership duplicates count once',()=>{
  const state={departments};
  assert.deepEqual(assignableDepartments(state).map(d=>d.id),['edit','motion']);
  assert.deepEqual(assignableDepartments({departments:[departments[0]]}),[]);
  const p={departmentId:'unit',departmentIds:['unit','edit','edit'],seniorityLevel:'artist'};
  assert.deepEqual(profileTeamIds(state,p),['edit']);assert.equal(derivedProfileTitle(state,p),'Video Editor');
  assert.equal(derivedProfileTitle(state,{departmentId:'unit',seniorityLevel:'manager'}),'Manager');
});
test('demo normalization updates titles and team anchors without touching identity, balances or operational history',()=>{
  const state={departments,profiles:[{id:'a',departmentId:'unit',departmentIds:['edit','motion'],seniorityLevel:'lead',title:'Manual',yearlyVacationDays:15,remainingVacationDays:5}],rotationVersions:[{profileId:'a',pattern:['night']}],vacationRequests:[{id:'request'}]};
  const before=structuredClone(state);normalizeDemoProfileStructure(state);
  assert.equal(state.profiles[0].title,'Lead Hybrid');assert.equal(state.profiles[0].departmentId,'edit');
  assert.equal(state.profiles[0].yearlyVacationDays,15);assert.equal(state.profiles[0].remainingVacationDays,5);
  assert.deepEqual(state.rotationVersions,before.rotationVersions);assert.deepEqual(state.vacationRequests,before.vacationRequests);
});
