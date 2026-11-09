import { datesBetween, scheduleFor, departmentLeadForDate, weekdayIndex, toIso } from './scheduleLogic.mjs';

export const shiftSeries = [
  { id:'morning', label:'Morning', color:'#d9b95f' },
  { id:'midday', label:'Mid-day', color:'#d79a71' },
  { id:'night', label:'Night', color:'#afa0df' },
  { id:'lead', label:'Lead', color:'#eb7895' },
  { id:'ground', label:'On Ground', color:'#6abbb0' }
];
const workIds = new Set(shiftSeries.map(s=>s.id));
const membership = p => [...new Set([p.departmentId,...(p.departmentIds||[])].filter(Boolean))];

// Demo mirrors the server boundary. Production obtains this snapshot through the protected RPC.
export function scopedAnalyticsState(state, { year, departmentId=null, directOnly=false, role, profileId }) {
  if (!['admin','lead'].includes(role)) throw new Error('Analytics is available to Admin and Lead only.');
  if (!Number.isInteger(year)||year<2000||year>2100) throw new Error('Choose a year between 2000 and 2100.');
  const own = membership(state.profiles.find(p=>p.id===profileId)||{});
  let ids = role==='admin' ? state.departments.map(d=>d.id) : own;
  if (departmentId) {
    if (!ids.includes(departmentId)) throw new Error('Department access denied.');
    ids=[departmentId];
    if (role==='admin'&&!directOnly) {
      for (let i=0;i<ids.length;i++) state.departments.filter(d=>d.parentDepartmentId===ids[i]).forEach(d=>{if(!ids.includes(d.id))ids.push(d.id);});
    }
  }
  const departments=state.departments.filter(d=>ids.includes(d.id));
  const profiles=state.profiles.filter(p=>role==='admin'&&!departmentId||membership(p).some(id=>ids.includes(id)))
    .map(p=>({id:p.id,name:p.name,departmentIds:membership(p).filter(id=>ids.includes(id))}));
  const visible=new Set(profiles.map(p=>p.id));
  const allowed=(rows,field)=>rows.filter(r=>visible.has(r.profileId)&&(!field||r[field].slice(0,4)===String(year)));
  return { year, departments, profiles, statuses:state.statuses.map(({id,label,kind})=>({id,label,kind})),
    rotationVersions:allowed(state.rotationVersions), scheduleOverrides:allowed(state.scheduleOverrides,'date'),
    departmentLeads:state.departmentLeads.filter(r=>ids.includes(r.departmentId)&&visible.has(r.profileId)&&r.date.slice(0,4)===String(year)),
    departmentLeadRotations:(state.departmentLeadRotations||[]).filter(r=>ids.includes(r.departmentId))
      .map(r=>({...r,pattern:r.pattern.map(id=>visible.has(id)?id:'')})),
    vacationRequests:allowed(state.vacationRequests).filter(r=>r.startDate<=`${year}-12-31`&&r.endDate>=`${year}-01-01`)
      .map(({id,profileId,startDate,endDate,status})=>({id,profileId,startDate,endDate,status})) };
}

export function analyticsRange(month, period='month') {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month.');
  const [year,m]=month.split('-').map(Number);
  if(year<2000||year>2100) throw new Error('Choose a year between 2000 and 2100.');
  const first=period==='year'?1:period==='quarter'?Math.floor((m-1)/3)*3+1:m;
  const last=period==='year'?12:period==='quarter'?first+2:m;
  const start=`${year}-${String(first).padStart(2,'0')}-01`,end=toIso(new Date(year,last,0));
  const label=period==='year'?`${year}`:period==='quarter'?`Q${Math.floor((m-1)/3)+1} · ${year}`:
    new Date(year,m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  return {year,start,end,label};
}

export function resolveAnalyticsDays(snapshot) {
  const result=[];
  for(const date of datesBetween(`${snapshot.year}-01-01`,`${snapshot.year}-12-31`)) {
    const leads=new Set(snapshot.departments.map(d=>departmentLeadForDate(snapshot,d.id,date).profile?.id).filter(Boolean));
    for(const p of snapshot.profiles) {
      const status=scheduleFor(snapshot,p.id,date);
      const id=status.kind==='working'&&status.id!=='ground'&&leads.has(p.id)?'lead':status.id||'empty';
      result.push({date,profileId:p.id,statusId:id});
    }
  }
  return result;
}

export function aggregateAnalytics(snapshot, days, month, period='month') {
  const range=analyticsRange(month,period);
  const blank=()=>Object.fromEntries([...shiftSeries.map(s=>s.id),'vacation','sick','weekend','empty','working'].map(id=>[id,0]));
  const validIds=new Set(Object.keys(blank()));
  const people=snapshot.profiles.map(p=>({...p,...blank()}));
  const byPerson=new Map(people.map(p=>[p.id,p]));
  const daily=datesBetween(range.start,range.end).map(date=>({date,...blank(),known:0}));
  const byDate=new Map(daily.map(d=>[d.date,d]));
  const months=Array.from({length:12},(_,m)=>({month:`${range.year}-${String(m+1).padStart(2,'0')}`,label:new Date(range.year,m,1).toLocaleDateString('en',{month:'short'}),vacation:0,sick:0,known:0}));
  for(const d of days) {
    const id=validIds.has(d.statusId)?d.statusId:'empty';
    const monthly=months[Number(d.date.slice(5,7))-1];
    if(id!=='empty')monthly.known++;
    if(id==='vacation'||id==='sick')monthly[id]++;
    const day=byDate.get(d.date),person=byPerson.get(d.profileId);
    if(!day||!person)continue;
    day[id]++;person[id]++;
    if(id!=='empty')day.known++;
    if(workIds.has(id)){day.working++;person.working++;}
  }
  const totals=blank();people.forEach(p=>Object.keys(totals).forEach(id=>totals[id]+=p[id]));
  const knownDays=daily.filter(d=>d.known>0);
  const weekdays=Array.from({length:7},(_,i)=>{
    const sample=knownDays.filter(d=>weekdayIndex(d.date)===i).map(d=>d.working);
    return {label:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],samples:sample.length,
      average:sample.length?sample.reduce((a,b)=>a+b,0)/sample.length:null,
      min:sample.length?Math.min(...sample):null,max:sample.length?Math.max(...sample):null};
  });
  const slots=people.length*daily.length,known=slots-totals.empty;
  return {range,daily,months,weekdays,people,totals,slots,known,departments:snapshot.departments,knownDays:knownDays.length,
    coverage:slots?Math.round(known/slots*100):0,
    average:knownDays.length?totals.working/knownDays.length:null,
    pending:snapshot.vacationRequests.filter(r=>r.status==='pending'&&r.startDate<=range.end&&r.endDate>=range.start).length,
    workingPeople:people.filter(p=>p.working>0).length};
}

export function analyticsCsv(model) {
  const cols=[['name','Person'],['working','Working'],...shiftSeries.map(s=>[s.id,s.label]),['vacation','Annual'],['sick','Sick'],['weekend','Weekend'],['empty','Unassigned']];
  const cell=value=>'"'+String(value??'').replace(/^[=+@\-\s]/,'\'$&').replaceAll('"','""')+'"';
  return '\uFEFF'+[cols.map(c=>cell(c[1])).join(','),...model.people.map(p=>cols.map(([id])=>cell(p[id])).join(','))].join('\r\n');
}
