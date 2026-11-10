import { shiftSeries } from './analyticsLogic.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'—':Number.isInteger(v)?v.toLocaleString('en-GB'):v.toFixed(1);
const dateLabel=d=>new Date(`${d}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const head=(title,sub,extra='')=>`<header class="analytics-panel-head"><div><h2>${title}</h2><p>${sub}</p></div>${extra}</header>`;
const empty=text=>`<div class="analytics-empty">${text}</div>`;

function staffing(model) {
  const w=760,h=220,left=38,right=18,top=18,bottom=32;
  const max=Math.max(1,...model.daily.map(d=>d.working),...model.daily.map(d=>d.vacation+d.sick));
  const ceiling=Math.max(4,Math.ceil(max/4)*4);
  const x=i=>left+i*(w-left-right)/Math.max(1,model.daily.length-1);
  const y=v=>h-bottom-v*(h-top-bottom)/ceiling;
  const paths=field=>{
    let segments=[],segment=[];
    model.daily.forEach((d,i)=>{if(!d.known){if(segment.length)segments.push(segment);segment=[];}else segment.push([x(i),y(field(d))]);});
    if(segment.length)segments.push(segment);
    return segments.map(points=>({line:points.map((p,i)=>`${i?'L':'M'}${p.join(',')}`).join(' '),area:`M${points[0][0]},${y(0)} L${points.map(p=>p.join(',')).join(' L')} L${points.at(-1)[0]},${y(0)} Z`,points}));
  };
  const work=paths(d=>d.working),leave=paths(d=>d.vacation+d.sick);
  const indexes=[...new Set(Array.from({length:6},(_,i)=>Math.round(i*(model.daily.length-1)/5)))];
  const table=`<details class="analytics-data"><summary>View daily data</summary><div class="analytics-table-scroll"><table><caption class="sr-only">Daily planned staffing</caption><thead><tr><th>Date</th><th>Working</th><th>Annual</th><th>Sick</th><th>Unassigned</th></tr></thead><tbody>${model.daily.map(d=>`<tr><th scope="row">${esc(d.date)}</th><td>${d.known?d.working:'—'}</td><td>${d.known?d.vacation:'—'}</td><td>${d.known?d.sick:'—'}</td><td>${d.empty}</td></tr>`).join('')}</tbody></table></div></details>`;
  return `<section class="analytics-panel analytics-staffing">${head('Daily staffing','People per day · saved working shifts and leave',`<div class="analytics-inline-legend"><span><i class="analytics-dot work"></i>Working</span><span><i class="analytics-dot leave"></i>Leave</span></div>`)}
    ${model.knownDays?`<div class="analytics-line-wrap"><svg class="analytics-line" viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily staffing. Exact values are available using the date slider or daily data table.">
      <defs><linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#df6885" stop-opacity=".32"/><stop offset="1" stop-color="#df6885" stop-opacity="0"/></linearGradient></defs>
      ${Array.from({length:5},(_,i)=>{const v=ceiling*i/4;return `<line class="analytics-gridline" x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${num(v)}</text>`;}).join('')}
      ${work.map(p=>`<path d="${p.area}" fill="url(#analytics-area)"/><path class="analytics-work-line" d="${p.line}"/>${p.points.map(([a,b])=>`<circle cx="${a}" cy="${b}" r="2" class="analytics-work-dot"/>`).join('')}`).join('')}
      ${leave.map(p=>`<path class="analytics-leave-line" d="${p.line}"/>`).join('')}
      ${indexes.map(i=>`<text x="${x(i)}" y="${h-8}" text-anchor="${i===0?'start':i===model.daily.length-1?'end':'middle'}">${dateLabel(model.daily[i].date)}</text>`).join('')}
      <line id="analytics-probe-line" class="analytics-probe-line" x1="${left}" x2="${left}" y1="${top}" y2="${h-bottom}"/>
    </svg></div>
    <div class="analytics-probe"><label for="analytics-date-probe">Inspect date</label><input id="analytics-date-probe" type="range" min="0" max="${model.daily.length-1}" value="0"/><output id="analytics-date-output" for="analytics-date-probe"></output></div>`:empty('No saved shifts in this period. Set a rotation or a daily shift to see staffing.')}
    <p class="analytics-footnote">Gaps mean no saved schedule. Partial days count known shifts only.</p>${table}</section>`;
}

function mix(model) {
  const total=model.totals.working,r=70,c=2*Math.PI*r;
  let offset=0;
  const arcs=shiftSeries.map(s=>{const fraction=total?model.totals[s.id]/total:0;
    const node=fraction?`<circle cx="100" cy="100" r="${r}" fill="none" stroke="${s.color}" stroke-width="17" stroke-dasharray="${fraction*c} ${c}" stroke-dashoffset="${-offset*c}" transform="rotate(-90 100 100)"/>`:'';offset+=fraction;return node;}).join('');
  return `<section class="analytics-panel analytics-mix">${head('Shift mix','Working person-days · Lead counted once')}
    <div class="analytics-donut"><svg viewBox="0 0 200 200" role="img" aria-label="Shift distribution; exact counts and percentages below"><circle cx="100" cy="100" r="70" class="analytics-ring" fill="none" stroke-width="17"/>${arcs}</svg><div><strong>${num(total)}</strong><span>work days</span></div></div>
    <ul class="analytics-legend">${shiftSeries.map(s=>`<li><span><i class="analytics-dot" style="--series:${s.color}"></i>${s.label}</span><strong>${num(model.totals[s.id])}</strong><small>${total?Math.round(model.totals[s.id]/total*100):0}%</small></li>`).join('')}</ul>
    ${!total?'<p class="analytics-footnote">No working shifts saved in this period.</p>':''}</section>`;
}

function weekdays(model) {
  const max=Math.max(1,...model.weekdays.map(d=>d.average||0));
  return `<section class="analytics-panel analytics-weekdays">${head('Weekday rhythm','Average people working · Monday to Sunday')}
    <div class="analytics-weekday-bars">${model.weekdays.map(d=>`<div class="analytics-weekday"><strong>${d.label}</strong><div class="analytics-track"><span style="width:${(d.average||0)/max*100}%"></span></div><b>${num(d.average)}</b><small>${d.samples?`${d.min}–${d.max} · ${d.samples} dates`:'No data'}</small></div>`).join('')}</div>
    <p class="analytics-footnote">Averages use dates with at least one saved shift; missing dates are excluded.</p></section>`;
}

function monthly(model) {
  const max=Math.max(1,...model.months.map(m=>m.vacation+m.sick));
  return `<section class="analytics-panel analytics-monthly">${head(`Leave by month · ${model.range.year}`,'Full calendar year · dated Annual and Sick person-days',`<div class="analytics-inline-legend"><span><i class="analytics-dot leave"></i>Annual</span><span><i class="analytics-dot sick"></i>Sick</span></div>`)}
    <div class="analytics-month-bars">${model.months.map(m=>`<button type="button" data-analytics-month="${m.month}" class="analytics-month ${m.month>=model.range.start.slice(0,7)&&m.month<=model.range.end.slice(0,7)?'selected':''}" aria-label="${m.label} ${model.range.year}: ${m.known?`${m.vacation} Annual, ${m.sick} Sick days`:'no saved schedule'}. Show month."><span class="analytics-month-value">${m.known?m.vacation+m.sick:'—'}</span><span class="analytics-month-column"><i class="sick" style="height:${m.sick/max*100}%"></i><i class="leave" style="height:${m.vacation/max*100}%"></i></span><span>${m.label}</span></button>`).join('')}</div>
    <output id="analytics-month-output" class="analytics-month-output"></output>
    <p class="analytics-footnote">Select a month to inspect it. Manual Annual balance deductions have no dates and are excluded.</p></section>`;
}

function people(model,sort) {
  const columns=[['name','Person'],['working','Work'],...shiftSeries.map(s=>[s.id,s.label]),['vacation','Annual'],['sick','Sick'],['empty','Unknown']];
  const rows=[...model.people].sort((a,b)=>{const n=sort.key==='name'?a.name.localeCompare(b.name):a[sort.key]-b[sort.key];return (sort.direction==='asc'?n:-n)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);});
  return `<section class="analytics-panel analytics-people">${head('People breakdown','Person-days in the selected period',`<span class="analytics-count">${model.people.length} people</span>`)}
    <div class="analytics-table-scroll"><table><caption class="sr-only">Scheduled shifts by person. Sort using column headers.</caption><thead><tr>${columns.map(([key,label])=>`<th scope="col" aria-sort="${sort.key===key?(sort.direction==='asc'?'ascending':'descending'):'none'}"><button type="button" data-analytics-sort="${key}">${label}${sort.key===key?sort.direction==='asc'?' ↑':' ↓':''}</button></th>`).join('')}</tr></thead><tbody>
    ${rows.map(p=>`<tr><th scope="row"><strong>${esc(p.name)}</strong><small>${esc(p.departmentIds.map(id=>model.departments.find(d=>d.id===id)?.name).filter(Boolean).join(' · ')||'Unassigned')}</small></th>${columns.slice(1).map(([key])=>`<td>${p[key]||'–'}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10">No people in this scope.</td></tr>'}</tbody></table></div></section>`;
}

export function renderAnalyticsDashboard(model,sort,entering=false) {
  const kpis=[['Scheduled work',num(model.totals.working),'person-days · includes Lead and On Ground'],['Average staffing',num(model.average),`people / day · ${model.knownDays} known dates`],['Annual + Sick',num(model.totals.vacation+model.totals.sick),`${model.totals.vacation} Annual · ${model.totals.sick} Sick person-days`],['Pending requests',num(model.pending),'requests overlapping this period']];
  return `<div class="analytics-dashboard${entering?' is-arriving':''}"><section class="analytics-kpis" aria-label="Period overview">${kpis.map(([label,value,detail],i)=>`<article class="analytics-kpi"><span>${label}</span><strong>${value}</strong><small>${detail}</small><div class="analytics-kpi-mark" aria-hidden="true">${['↗','◷','◈','◇'][i]}</div></article>`).join('')}</section>
    <div class="analytics-grid">${staffing(model)}${mix(model)}${weekdays(model)}${monthly(model)}${people(model,sort)}
    <section class="analytics-panel analytics-quality">${head('Schedule completeness','What these numbers cover')}
      <div class="analytics-completeness"><strong>${model.coverage}%</strong><span>of person-days have saved shifts</span></div><div class="analytics-track"><span style="width:${model.coverage}%"></span></div>
      <dl><div><dt>Known person-days</dt><dd>${num(model.known)}</dd></div><div><dt>Unassigned person-days</dt><dd>${num(model.totals.empty)}</dd></div><div><dt>People with working shifts</dt><dd>${model.workingPeople} / ${model.people.length}</dd></div></dl>
      <p class="analytics-footnote">Planned shifts, not attendance or hours. People shared by teams count once. Scope uses current department membership.</p>
      <p class="analytics-footnote">Annual and Sick count dated saved leave. Pending requests do not reduce staffing until approved.</p></section></div></div>`;
}

export function bindAnalyticsProbe(model) {
  const monthOutput=document.querySelector('#analytics-month-output');
  const showMonth=month=>{if(monthOutput)monthOutput.textContent=`${month.label} ${model.range.year} · ${month.known?`${month.vacation} Annual · ${month.sick} Sick person-days`:'No saved schedule'}`;};
  document.querySelectorAll('[data-analytics-month]').forEach(button=>{
    const update=()=>showMonth(model.months.find(m=>m.month===button.dataset.analyticsMonth));
    button.addEventListener('pointerenter',update);button.addEventListener('focus',update);
  });
  showMonth(model.months.find(m=>m.month===model.range.start.slice(0,7)));
  const range=document.querySelector('#analytics-date-probe'),output=document.querySelector('#analytics-date-output');
  if(!range||!output)return;
  const update=()=>{const index=Number(range.value),d=model.daily[index];
    output.textContent=`${dateLabel(d.date)} · ${d.known?`${d.working} working · ${d.vacation} Annual · ${d.sick} Sick`:'No saved schedule'}${d.empty?` · ${d.empty} unassigned`:''}`;
    range.setAttribute('aria-valuetext',output.textContent);
    const x=38+index*704/Math.max(1,model.daily.length-1),line=document.querySelector('#analytics-probe-line');
    line?.setAttribute('x1',x);line?.setAttribute('x2',x);
  };
  range.addEventListener('input',update);
  document.querySelector('.analytics-line')?.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const rect=event.currentTarget.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*760;
    range.value=String(Math.max(0,Math.min(model.daily.length-1,Math.round((x-38)/704*(model.daily.length-1)))));update();
  });
  update();
}
