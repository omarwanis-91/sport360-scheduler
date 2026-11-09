import test from 'node:test';
import assert from 'node:assert/strict';
import { annualYear, syncDemoAnnualBalances, annualBalanceImpact, deductDemoAnnual } from '../src/annualBalances.mjs';
const fixture=()=>({profiles:[{id:'a',yearlyVacationDays:15,remainingVacationDays:5}],vacationRequests:[{id:'old',status:'approved'}],scheduleOverrides:[{date:'2026-06-01',statusId:'sick'}],auditLog:[]});
test('Cairo changes year at local midnight, independently of the machine timezone',()=>{
 assert.equal(annualYear(new Date('2026-12-31T21:59:59Z')),2026);
 assert.equal(annualYear(new Date('2026-12-31T22:00:00Z')),2027);
});
test('opening balance is preserved; renewal archives the previous year and happens once',()=>{
 const s=fixture();syncDemoAnnualBalances(s,new Date('2026-11-08T12:00Z'));
 assert.equal(s.profiles[0].remainingVacationDays,5);
 const records=structuredClone({requests:s.vacationRequests,overrides:s.scheduleOverrides});
 syncDemoAnnualBalances(s,new Date('2026-12-31T22:00Z'));
 assert.equal(s.profiles[0].remainingVacationDays,15);assert.equal(s.annualBalances[0].remaining,5);
 const once=structuredClone(s);syncDemoAnnualBalances(s,new Date('2027-04-01T12:00Z'));assert.deepEqual(s,once);
 assert.deepEqual({requests:s.vacationRequests,overrides:s.scheduleOverrides},records);
 s.profiles[0].remainingVacationDays=3;syncDemoAnnualBalances(s,new Date('2027-06-01T12:00Z'));assert.equal(s.profiles[0].remainingVacationDays,3);
});
test('December/January deductions use separate years and survive renewal without double deduction',()=>{
 const s=syncDemoAnnualBalances(fixture(),new Date('2026-11-08T12:00Z')),p=s.profiles[0];
 const dates=['2026-12-31','2027-01-01','2027-01-02'];
 assert.deepEqual(annualBalanceImpact(s,p,dates).map(b=>b.after),[4,13]);
 assert.deepEqual(deductDemoAnnual(s,p,dates),{2026:1,2027:2});assert.equal(p.remainingVacationDays,4);
 syncDemoAnnualBalances(s,new Date('2026-12-31T22:00Z'));assert.equal(p.remainingVacationDays,13);
 assert.equal(s.annualBalances[0].remaining,4);
});
test('legacy approved future dates remain reserved without rewriting a manually entered current remainder',()=>{
 const s=fixture();s.vacationRequests=[{id:'legacy',profileId:'a',status:'approved'}];
 s.scheduleOverrides=[{profileId:'a',date:'2027-01-01',statusId:'vacation',note:'Vacation request legacy'}];
 syncDemoAnnualBalances(s,new Date('2026-11-08T12:00Z'));assert.equal(s.profiles[0].remainingVacationDays,5);
 syncDemoAnnualBalances(s,new Date('2026-12-31T22:00Z'));assert.equal(s.profiles[0].remainingVacationDays,14);
 assert.equal(s.vacationRequests[0].status,'approved');
});
test('zero allowance, skipped years, updated entitlement and atomic rejection remain correct',()=>{
 const s=syncDemoAnnualBalances(fixture(),new Date('2026-11-08T12:00Z')),p=s.profiles[0];
 deductDemoAnnual(s,p,['2027-01-01']);p.yearlyVacationDays=20;
 syncDemoAnnualBalances(s,new Date('2026-12-31T22:00Z'));assert.equal(p.remainingVacationDays,19);
 syncDemoAnnualBalances(s,new Date('2029-01-01T12:00Z'));assert.equal(p.remainingVacationDays,20);
 assert.equal(s.annualBalances.find(b=>b.year===2028).remaining,20);
 p.remainingVacationDays=0;syncDemoAnnualBalances(s,new Date('2029-01-01T12:00Z'));
 const before=structuredClone(s);assert.throws(()=>deductDemoAnnual(s,p,['2029-12-31','2030-01-01']),/Insufficient/);assert.deepEqual(s,before);
 p.yearlyVacationDays=0;syncDemoAnnualBalances(s,new Date('2030-01-01T12:00Z'));assert.equal(p.remainingVacationDays,0);
});
