import { datesBetween, parseDate, scheduleFor, departmentLeadForDate, holidayAppliesToProfile, weekdayIndex, toIso } from './scheduleLogic.mjs';

export const shiftSeries = [
  { id:'morning', label:'Morning', color:'#d9b95f' },
  { id:'midday', label:'Mid-day', color:'#d79a71' },
  { id:'night', label:'Night', color:'#afa0df' },
  { id:'lead', label:'Lead', color:'#eb7895' },
  { id:'ground', label:'On Ground', color:'#6abbb0' }
];
const workIds = new Set(shiftSeries.map(s=>s.id));
export const shiftMixSeries = shiftSeries.filter(({ id }) => id !== 'lead');
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
  const publicHolidays = (state.publicHolidays || []).filter(holiday => holiday.date.slice(0, 4) === String(year))
    .map(holiday => ({ date: holiday.date, dayOff: holiday.dayOff, batchId: holiday.batchId,
      profileIds: profiles.filter(person => holidayAppliesToProfile(state, holiday, person.id)
        && (!holiday.batchId || (!state.lowDayCredits?.some(credit => credit.reason !== 'holiday_shortfall' && credit.profileId === person.id && credit.workedDate === holiday.date)
          && !state.scheduleOverrides.some(override => override.profileId === person.id && override.date === holiday.date
            && override.holidayOverrideBatchId === holiday.batchId))))
        .map(person => person.id) }))
    .filter(holiday => holiday.profileIds.length);
  return { year, departments, profiles, statuses:state.statuses.map(({id,label,kind})=>({id,label,kind})),
    publicHolidays,
    rotationVersions:allowed(state.rotationVersions), scheduleOverrides:allowed(state.scheduleOverrides,'date'),
    departmentLeads:state.departmentLeads.filter(r=>ids.includes(r.departmentId)&&visible.has(r.profileId)&&r.date.slice(0,4)===String(year)),
    departmentLeadRotations:(state.departmentLeadRotations||[]).filter(r=>ids.includes(r.departmentId))
      .map(r=>({...r,pattern:r.pattern.map(id=>visible.has(id)?id:'')})),
    vacationRequests:allowed(state.vacationRequests).filter(r=>r.startDate<=`${year}-12-31`&&r.endDate>=`${year}-01-01`)
      .map(({id,profileId,startDate,endDate,status})=>({id,profileId,startDate,endDate,status})) };
}

export function analyticsRange(month, period='month', customDates) {
  if (period === 'custom') {
    const { start, end } = customDates || {};
    const valid = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && date >= '2000-01-01' && date <= '2100-12-31' && toIso(parseDate(date)) === date;
    if (!valid(start) || !valid(end) || end < start) throw new Error('Choose a valid start and end date.');
    const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const label = formatter.formatRange(parseDate(start), parseDate(end));
    return { year: Number(start.slice(0, 4)), start, end, label };
  }
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
      result.push({date,profileId:p.id,statusId:id,shiftId:status.id || 'empty'});
    }
  }
  return result;
}

export function aggregateAnalytics(snapshot, days, month, period='month', customDates) {
  const range=analyticsRange(month,period,customDates);
  const custom=period==='custom';
  const blank=()=>Object.fromEntries([...shiftSeries.map(s=>s.id),'vacation','sick','weekend','public_holiday','low_day','empty','working'].map(id=>[id,0]));
  const validIds=new Set(Object.keys(blank()));
  const people=snapshot.profiles.map(p=>({...p,...blank()}));
  const byPerson=new Map(people.map(p=>[p.id,p]));
  const daily=datesBetween(range.start,range.end).map(date=>({date,...blank(),empty:people.length,known:0}));
  people.forEach(person=>{person.empty=daily.length;});
  const byDate=new Map(daily.map(d=>[d.date,d]));
  const months=[];
  const monthStart=custom?range.start.slice(0,7):`${range.year}-01`;
  const monthEnd=custom?range.end.slice(0,7):`${range.year}-12`;
  const monthLabel=new Intl.DateTimeFormat('en',{month:'short'});
  for(const date=parseDate(`${monthStart}-01`);toIso(date).slice(0,7)<=monthEnd;date.setMonth(date.getMonth()+1)) {
    months.push({month:toIso(date).slice(0,7),label:monthLabel.format(date),vacation:0,sick:0,known:0});
  }
  const byMonth=new Map(months.map(bucket=>[bucket.month,bucket]));
  const shiftMix=Object.fromEntries([...shiftMixSeries.map(s=>s.id),'other'].map(id=>[id,0]));
  for(const d of days) {
    const id=validIds.has(d.statusId)?d.statusId:'empty';
    if(id==='empty')continue;
    const day=byDate.get(d.date),person=byPerson.get(d.profileId);
    const monthly=(!custom||day)&&byMonth.get(d.date.slice(0,7));
    if(monthly) {
      monthly.known++;
      if(id==='vacation'||id==='sick')monthly[id]++;
    }
    if(!day||!person)continue;
    day[id]++;person[id]++;
    day.empty--;person.empty--;day.known++;
    if(workIds.has(id)){
      day.working++;person.working++;
      const shiftId=d.shiftId||id;
      shiftMix[Object.hasOwn(shiftMix,shiftId)?shiftId:'other']++;
    }
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
  return {range,custom,daily,months,weekdays,people,totals,shiftMix,slots,known,departments:snapshot.departments,knownDays:knownDays.length,
    coverage:slots?Math.round(known/slots*100):0,
    average:knownDays.length?totals.working/knownDays.length:null,
    pending:snapshot.vacationRequests.filter(r=>r.status==='pending'&&r.startDate<=range.end&&r.endDate>=range.start).length,
    workingPeople:people.filter(p=>p.working>0).length};
}

export function analyticsPeople(people, hierarchy, sort, levels) {
  const rank = new Map(levels.map(([id], index) => [id, index]));
  return people.filter(person => hierarchy === 'all' || person.seniorityLevel === hierarchy).sort((a, b) => {
    const order = sort.key === 'name' ? a.name.localeCompare(b.name)
      : sort.key === 'seniorityLevel' ? rank.get(a.seniorityLevel) - rank.get(b.seniorityLevel)
      : a[sort.key] - b[sort.key];
    return (sort.direction === 'asc' ? order : -order) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

export function analyticsCsv(model) {
  const cols=[['name','Person'],['working','Working'],...shiftSeries.map(s=>[s.id,s.label]),['vacation','Annual'],['sick','Sick'],['weekend','Weekend'],['public_holiday','Public Holiday'],['low_day','Replacement Day'],['empty','Unassigned']];
  const cell=value=>'"'+String(value??'').replace(/^[=+@\-\s]/,'\'$&').replaceAll('"','""')+'"';
  return '\uFEFF'+[cols.map(c=>cell(c[1])).join(','),...model.people.map(p=>cols.map(([id])=>cell(p[id])).join(','))].join('\r\n');
}
