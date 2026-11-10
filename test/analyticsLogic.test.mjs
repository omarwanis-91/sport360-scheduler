import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../src/data.js';
import { scopedAnalyticsState,resolveAnalyticsDays,aggregateAnalytics,analyticsRange,analyticsCsv } from '../src/analyticsLogic.mjs';
const scope=(s,options={})=>scopedAnalyticsState(s,{year:2026,role:'admin',...options});
const model=(s,options={})=>{const snapshot=scope(s,options);return aggregateAnalytics(snapshot,resolveAnalyticsDays(snapshot),'2026-11');};
function fixture() {
  const s=structuredClone(seedState);
  s.departments=[{id:'parent',name:'Video Unit'},{id:'ops',name:'Video Edit',parentDepartmentId:'parent'},{id:'other',name:'Motion',parentDepartmentId:'parent'}];
  s.profiles=s.profiles.slice(0,3);
  s.profiles[0].departmentId='parent';s.profiles[0].departmentIds=['parent'];
  s.profiles[1].departmentIds=['ops','other'];
  s.profiles[2].departmentId='other';s.profiles[2].departmentIds=['other'];
  s.rotationVersions=s.profiles.map(p=>({id:p.id,profileId:p.id,effectiveStart:'2026-11-01',pattern:['morning','midday','night','morning','morning','weekend','weekend']}));
  s.scheduleOverrides=[];s.departmentLeads=[];s.departmentLeadRotations=[];s.vacationRequests=[];
  return s;
}
test('scope deduplicates shared members, supports Admin parent scope and prevents Lead child/unassigned reads',()=>{
  const s=fixture();
  assert.equal(scope(s,{departmentId:'parent'}).profiles.length,3);
  assert.equal(scope(s,{departmentId:'parent',directOnly:true}).profiles.length,1);
  const lead=scope(s,{role:'lead',profileId:'emp-002',departmentId:'ops'});
  assert.deepEqual(lead.profiles.map(p=>p.id),['emp-002']);
  assert.deepEqual(lead.profiles[0].departmentIds,['ops']);
  assert.equal(scope(s,{role:'lead',profileId:'emp-002'}).profiles.length,2);
  assert.throws(()=>scope(s,{role:'lead',profileId:'emp-002',departmentId:'parent'}),/denied/);
  assert.throws(()=>scope(s,{role:'employee',profileId:'emp-002'}),/Admin and Lead/);
  assert.ok(!JSON.stringify(lead).includes('@company.test'));
});
test('Lead replaces underlying work once; daily leave and Ground win, no automatic lead fallback',()=>{
  const s=fixture();s.departmentLeadRotations=[{id:'l',departmentId:'ops',effectiveStart:'2026-11-01',pattern:Array(7).fill('emp-002')}];
  s.scheduleOverrides=[{profileId:'emp-002',date:'2026-11-02',statusId:'vacation'},{profileId:'emp-002',date:'2026-11-03',statusId:'sick'},{profileId:'emp-002',date:'2026-11-04',statusId:'ground'}];
  const m=model(s,{departmentId:'ops'});
  assert.equal(m.people.length,1);assert.equal(m.totals.lead,18);assert.equal(m.totals.ground,1);
  assert.equal(m.totals.working,19);assert.equal(m.totals.vacation,1);assert.equal(m.totals.sick,1);
  assert.equal(m.totals.morning+m.totals.midday+m.totals.night,0);
  s.departmentLeadRotations=[];assert.equal(model(s).totals.lead,0);
});
test('effective versions repeat beyond first week and specific overrides take precedence',()=>{
  const s=fixture();s.rotationVersions.push({id:'later',profileId:'emp-002',effectiveStart:'2026-11-15',pattern:Array(7).fill('night')});
  s.scheduleOverrides=[{profileId:'emp-002',date:'2026-11-16',statusId:'midday'}];
  const snapshot=scope(s,{departmentId:'ops'}),days=resolveAnalyticsDays(snapshot);
  const at=date=>days.find(d=>d.date===date).statusId;
  assert.equal(at('2026-11-09'),'morning');assert.equal(at('2026-11-15'),'night');assert.equal(at('2026-11-16'),'midday');assert.equal(at('2026-11-23'),'night');
});
test('unknown dates are gaps, never implicit off days; averages exclude unknown dates',()=>{
  const s=fixture();s.rotationVersions=[];s.scheduleOverrides=[{profileId:'emp-002',date:'2026-11-02',statusId:'morning'},{profileId:'emp-002',date:'2026-11-09',statusId:'weekend'}];
  const m=model(s,{departmentId:'ops'});
  assert.equal(m.knownDays,2);assert.equal(m.average,.5);assert.equal(m.totals.empty,28);assert.equal(m.coverage,7);
  assert.equal(m.weekdays[0].average,.5);assert.equal(m.weekdays[1].average,null);
  assert.equal(m.months[0].known,0);assert.equal(m.months[10].known,2);
});
test('monthly leave comes only from dated records; pending, rejected and opening deductions are excluded',()=>{
  const s=fixture();s.profiles[1].remainingVacationDays=0;
  s.scheduleOverrides=[{profileId:'emp-002',date:'2026-11-02',statusId:'vacation'},{profileId:'emp-002',date:'2026-12-31',statusId:'sick'}];
  s.vacationRequests=[{id:'pending',profileId:'emp-002',startDate:'2026-10-30',endDate:'2026-11-02',status:'pending'},
    {id:'rejected',profileId:'emp-002',startDate:'2026-11-09',endDate:'2026-11-10',status:'rejected'}];
  const m=model(s,{departmentId:'ops'});
  assert.equal(m.pending,1);assert.equal(m.totals.vacation,1);assert.equal(m.totals.sick,0);
  assert.equal(m.months[10].vacation,1);assert.equal(m.months[11].sick,1);
});
test('month, quarter and year ranges include leap days and reject invalid input',()=>{
  assert.equal(analyticsRange('2024-02').end,'2024-02-29');
  assert.deepEqual(analyticsRange('2026-11','quarter'),{year:2026,start:'2026-10-01',end:'2026-12-31',label:'Q4 · 2026'});
  assert.equal(analyticsRange('2026-11','year').start,'2026-01-01');
  assert.throws(()=>analyticsRange('2026-13'));assert.throws(()=>analyticsRange('1800-01'));
});
test('CSV includes exact filtered totals and neutralizes spreadsheet formulas in names',()=>{
  const s=fixture();s.profiles[1].name='=HYPERLINK("x")';
  const csv=analyticsCsv(model(s,{departmentId:'ops'}));
  assert.ok(csv.startsWith('\uFEFF"Person"'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.equal(csv.split('\r\n').length,2);
  s.profiles[1].name='  =SUM(1,2)';assert.ok(analyticsCsv(model(s,{departmentId:'ops'})).includes('"\'  =SUM(1,2)"'));
});
