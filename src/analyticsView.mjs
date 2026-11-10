import { shiftSeries } from './analyticsLogic.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'—':Number.isInteger(v)?v.toLocaleString('en-GB'):v.toFixed(1);
const dateLabel=d=>new Date(`${d}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const head=(title,sub,extra='')=>`<header class="analytics-panel-head"><div><h2>${title}</h2><p>${sub}</p></div>${extra}</header>`;
const empty=text=>`<div class="analytics-empty">${text}</div>`;

function staffing(model) {
  const w=840,h=280,left=48,right=20,top=24,bottom=40;
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
  const glow=field=>model.daily.slice(1).map((d,i)=>{
    const previous=model.daily[i];
    if(!d.known||!previous.known)return '';
    const strength=(field(d)+field(previous))/(2*max);
    return `<path class="analytics-value-glow" d="M${x(i)},${y(field(previous))} L${x(i+1)},${y(field(d))}" stroke-width="${4+16*strength}" opacity="${(.72*strength).toFixed(3)}"/>`;
  }).join('');
  const firstKnown=model.daily.findIndex(d=>d.known);
  const indexes=[...new Set(Array.from({length:6},(_,i)=>Math.round(i*(model.daily.length-1)/5)))];
  const table=`<details class="analytics-data"><summary>View daily data</summary><div class="analytics-table-scroll"><table><caption class="sr-only">Daily planned staffing</caption><thead><tr><th>Date</th><th>Working</th><th>Annual</th><th>Sick</th><th>Unassigned</th></tr></thead><tbody>${model.daily.map(d=>`<tr><th scope="row">${esc(d.date)}</th><td>${d.known?d.working:'—'}</td><td>${d.known?d.vacation:'—'}</td><td>${d.known?d.sick:'—'}</td><td>${d.empty}</td></tr>`).join('')}</tbody></table></div></details>`;
  return `<section class="analytics-panel analytics-staffing">${head('Daily staffing','People per day · saved working shifts and leave',`<div class="analytics-inline-legend"><span><i class="analytics-dot work"></i>Working</span><span><i class="analytics-dot leave"></i>Leave</span></div>`)}
    ${model.knownDays?`<div class="analytics-line-wrap"><div class="analytics-line-scroll"><svg class="analytics-line" viewBox="0 0 ${w} ${h}" role="group" aria-label="Daily staffing. Hover or tap a point for values. Use arrow keys between dates, or view the daily data table.">
      <defs><linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ef8da5" stop-opacity=".48"/><stop offset=".65" stop-color="#c55175" stop-opacity=".14"/><stop offset="1" stop-color="#a33256" stop-opacity="0"/></linearGradient><filter id="analytics-line-halo" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="6"/></filter></defs>
      ${Array.from({length:5},(_,i)=>{const v=ceiling*i/4;return `<line class="analytics-gridline" x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${num(v)}</text>`;}).join('')}
      <g class="analytics-work-halo" filter="url(#analytics-line-halo)">${glow(d=>d.working)}</g>
      <g class="analytics-leave-halo" filter="url(#analytics-line-halo)">${glow(d=>d.vacation+d.sick)}</g>
      ${work.map(p=>`<path d="${p.area}" fill="url(#analytics-area)"/><path class="analytics-work-line" d="${p.line}"/>`).join('')}
      ${leave.map(p=>`<path class="analytics-leave-line" d="${p.line}"/>`).join('')}
      ${indexes.map(i=>`<text x="${x(i)}" y="${h-8}" text-anchor="${i===0?'start':i===model.daily.length-1?'end':'middle'}">${dateLabel(model.daily[i].date)}</text>`).join('')}
      ${model.daily.map((d,i)=>d.known?`<circle cx="${x(i)}" cy="${y(d.working)}" r="3.4" class="analytics-work-dot" data-analytics-point="${i}" tabindex="${i===firstKnown?0:-1}" role="button" aria-label="${esc(d.date)}: ${d.working} working, ${d.vacation} Annual, ${d.sick} Sick, ${d.empty} unassigned" aria-describedby="analytics-point-tooltip"/><circle cx="${x(i)}" cy="${y(d.vacation+d.sick)}" r="2.6" class="analytics-leave-dot"/>`:'').join('')}
      <line id="analytics-probe-line" class="analytics-probe-line" x1="${left}" x2="${left}" y1="${top}" y2="${h-bottom}" hidden/>
      <circle id="analytics-active-point" r="6" class="analytics-active-point" hidden/>
    </svg></div><div id="analytics-point-tooltip" class="analytics-chart-tooltip" role="tooltip" hidden></div></div>
    <p class="analytics-chart-hint">Hover or tap a point for details. Arrow keys move between dates.</p>`:empty('No saved shifts in this period. Set a rotation or a daily shift to see staffing.')}
    <p class="analytics-footnote">Gaps mean no saved schedule. Partial days count known shifts only.</p>${table}</section>`;
}

function mix(model) {
  const total=model.totals.working,r=73,c=2*Math.PI*r;
  const max=Math.max(1,...shiftSeries.map(s=>model.totals[s.id]));
  let offset=0;
  const arcs=shiftSeries.map(s=>{const fraction=total?model.totals[s.id]/total:0;
    const strength=model.totals[s.id]/max;
    const geometry=`cx="100" cy="100" r="${r}" fill="none" stroke-dasharray="${fraction*c} ${c}" stroke-dashoffset="${-offset*c}" transform="rotate(-90 100 100)"`;
    const node=fraction?`<circle ${geometry} stroke="${s.color}" stroke-width="30" opacity="${(.65*strength).toFixed(3)}" filter="url(#analytics-mix-halo)" data-mix-glow="${s.id}"/><circle ${geometry} stroke="url(#analytics-mix-${s.id})" stroke-width="22" class="analytics-mix-segment"/>`:'';offset+=fraction;return node;}).join('');
  return `<section class="analytics-panel analytics-mix">${head('Shift mix','Working person-days · Lead counted once')}
    <div class="analytics-mix-content"><div class="analytics-donut"><svg viewBox="0 0 200 200" role="img" aria-label="Shift distribution; exact counts and percentages beside the chart"><defs><filter id="analytics-mix-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>${shiftSeries.map(s=>`<linearGradient id="analytics-mix-${s.id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${s.color}"/><stop offset=".45" stop-color="${s.color}"/><stop offset="1" stop-color="${s.color}" stop-opacity=".55"/></linearGradient>`).join('')}</defs><circle cx="100" cy="100" r="73" class="analytics-ring" fill="none" stroke-width="22"/>${arcs}</svg><div><strong>${num(total)}</strong><span>work days</span></div></div>
    <ul class="analytics-legend">${shiftSeries.map(s=>`<li style="--series:${s.color};--glow:${(model.totals[s.id]/max*.4).toFixed(3)}"><span><i class="analytics-dot"></i>${s.label}</span><strong>${num(model.totals[s.id])}</strong><small>${total?Math.round(model.totals[s.id]/total*100):0}%</small><div class="analytics-mix-track"><i style="width:${total?model.totals[s.id]/total*100:0}%"></i></div></li>`).join('')}</ul></div>
    ${!total?'<p class="analytics-footnote">No working shifts saved in this period.</p>':''}</section>`;
}

function weekdays(model) {
  const max=Math.max(1,...model.weekdays.map(d=>d.average||0));
  return `<section class="analytics-panel analytics-weekdays">${head('Weekday rhythm','Average people working · Monday to Sunday')}
    <div class="analytics-weekday-bars">${model.weekdays.map(d=>`<div class="analytics-weekday"><strong>${d.label}</strong><div class="analytics-track" style="--glow:${((d.average||0)/max*.5).toFixed(3)}"><span style="width:${(d.average||0)/max*100}%"></span></div><b>${num(d.average)}</b><small>${d.samples?`${d.min}–${d.max} · ${d.samples} dates`:'No data'}</small></div>`).join('')}</div>
    <p class="analytics-footnote">Averages use dates with at least one saved shift; missing dates are excluded.</p></section>`;
}

function monthly(model) {
  const max=Math.max(1,...model.months.map(m=>m.vacation+m.sick));
  return `<section class="analytics-panel analytics-monthly">${head(`Leave by month · ${model.range.year}`,'Full calendar year · dated Annual and Sick person-days',`<div class="analytics-inline-legend"><span><i class="analytics-dot leave"></i>Annual</span><span><i class="analytics-dot sick"></i>Sick</span></div>`)}
    <div class="analytics-month-bars">${model.months.map(m=>`<button type="button" data-analytics-month="${m.month}" class="analytics-month ${m.month>=model.range.start.slice(0,7)&&m.month<=model.range.end.slice(0,7)?'selected':''}" aria-label="${m.label} ${model.range.year}: ${m.known?`${m.vacation} Annual, ${m.sick} Sick days`:'no saved schedule'}. Show month."><span class="analytics-month-value">${m.known?m.vacation+m.sick:'—'}</span><span class="analytics-month-column"><i class="sick" style="height:${m.sick/max*100}%;--glow:${(m.sick/max*.5).toFixed(3)}"></i><i class="leave" style="height:${m.vacation/max*100}%;--glow:${(m.vacation/max*.5).toFixed(3)}"></i></span><span>${m.label}</span></button>`).join('')}</div>
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
  const intensity=[model.known?model.totals.working/model.known:0,model.people.length?(model.average||0)/model.people.length:0,model.known?(model.totals.vacation+model.totals.sick)/model.known:0,model.people.length?Math.min(1,model.pending/model.people.length):0];
  return `<div class="analytics-dashboard${entering?' is-arriving':''}"><section class="analytics-kpis" aria-label="Period overview">${kpis.map(([label,value,detail],i)=>`<article class="analytics-kpi" style="--metric-glow:${(.4*intensity[i]).toFixed(3)}"><span>${label}</span><strong>${value}</strong><small>${detail}</small><div class="analytics-kpi-mark" aria-hidden="true">${['↗','◷','◈','◇'][i]}</div></article>`).join('')}</section>
    <div class="analytics-grid">${staffing(model)}${mix(model)}${weekdays(model)}${monthly(model)}${people(model,sort)}
    <section class="analytics-panel analytics-quality">${head('Schedule completeness','What these numbers cover')}
      <div class="analytics-completeness"><strong>${model.coverage}%</strong><span>of person-days have saved shifts</span></div><div class="analytics-track" style="--glow:${(model.coverage/100*.5).toFixed(3)}"><span style="width:${model.coverage}%"></span></div>
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
  const svg=document.querySelector('.analytics-line'),wrap=document.querySelector('.analytics-line-wrap');
  const tooltip=document.querySelector('#analytics-point-tooltip');
  if(!svg||!tooltip||!wrap)return;
  const points=[...svg.querySelectorAll('[data-analytics-point]')];
  const line=svg.querySelector('#analytics-probe-line'),marker=svg.querySelector('#analytics-active-point');
  const ceiling=Math.max(4,Math.ceil(Math.max(1,...model.daily.map(d=>Math.max(d.working,d.vacation+d.sick)))/4)*4);
  const x=index=>48+index*772/Math.max(1,model.daily.length-1),y=value=>240-value*216/ceiling;
  let active=-1,series='working',hideTimer,touchStart,pinned=false;
  const hide=()=>{pinned=false;tooltip.hidden=true;line.setAttribute('hidden','');marker.setAttribute('hidden','');};
  const cancelHide=()=>clearTimeout(hideTimer);
  const scheduleHide=()=>{cancelHide();hideTimer=setTimeout(()=>{if(!pinned&&!points.includes(document.activeElement))hide();},180);};
  const show=(index,kind='working')=>{
    cancelHide();const d=model.daily[index];if(!d?.known)return;
    if(active!==index||tooltip.hidden) {
      tooltip.innerHTML=`<strong class="analytics-tooltip-date">${esc(new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))}</strong><dl class="analytics-tooltip-values">${[['Working',d.working],['Annual',d.vacation],['Sick',d.sick],['Unassigned',d.empty]].map(([label,value])=>`<div><dt>${label}</dt><dd>${num(value)}</dd></div>`).join('')}</dl><div class="analytics-tooltip-shifts">${shiftSeries.map(s=>`<span>${s.label} <b>${d[s.id]}</b></span>`).join('')}</div>`;
    }
    active=index;series=kind;tooltip.hidden=false;
    const cx=x(index),cy=y(kind==='working'?d.working:d.vacation+d.sick);
    line.removeAttribute('hidden');line.setAttribute('x1',cx);line.setAttribute('x2',cx);
    marker.removeAttribute('hidden');marker.setAttribute('cx',cx);marker.setAttribute('cy',cy);marker.dataset.series=series;
    const rect=svg.getBoundingClientRect(),bounds=wrap.getBoundingClientRect();
    const px=rect.left-bounds.left+cx/840*rect.width,py=rect.top-bounds.top+cy/280*rect.height;
    const tw=tooltip.offsetWidth,th=tooltip.offsetHeight;
    const beside=px+18+tw<=bounds.width?px+18:px-tw-18;
    const left=Math.max(0,Math.min(bounds.width-tw,beside));
    const above=py-th-14;
    tooltip.style.left=`${left}px`;tooltip.style.top=`${Math.max(0,above>=0?above:Math.min(wrap.offsetHeight-th,py+18))}px`;
  };
  const nearest=event=>{
    const rect=svg.getBoundingClientRect();
    const index=Math.max(0,Math.min(model.daily.length-1,Math.round(((event.clientX-rect.left)/rect.width*840-48)/772*(model.daily.length-1))));
    const d=model.daily[index];if(!d?.known)return null;
    const px=rect.left+x(index)/840*rect.width;
    const workingY=rect.top+y(d.working)/280*rect.height,leaveY=rect.top+y(d.vacation+d.sick)/280*rect.height;
    const kind=Math.abs(event.clientY-workingY)<=Math.abs(event.clientY-leaveY)?'working':'leave';
    const py=kind==='working'?workingY:leaveY;
    return {index,kind,distance:Math.hypot(px-event.clientX,py-event.clientY)};
  };
  svg.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    pinned=false;
    const point=nearest(event);
    if(point&&point.distance<=22)show(point.index,point.kind);else scheduleHide();
  });
  svg.addEventListener('pointerdown',event=>{touchStart={x:event.clientX,y:event.clientY};});
  svg.addEventListener('pointerup',event=>{
    if(event.pointerType!=='touch'||!touchStart||Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)>8)return;
    const point=nearest(event);if(point){pinned=true;show(point.index,point.kind);}
  });
  wrap.addEventListener('pointerleave',scheduleHide);tooltip.addEventListener('pointerenter',cancelHide);
  svg.closest('.analytics-dashboard')?.addEventListener('pointerdown',event=>{if(!wrap.contains(event.target))hide();});
  svg.closest('.analytics-line-scroll')?.addEventListener('scroll',()=>{
    const focused=points.find(point=>point===document.activeElement);
    if(focused)show(Number(focused.dataset.analyticsPoint));else hide();
  },{passive:true});
  points.forEach((point,index)=>{
    point.addEventListener('focus',()=>{points.forEach(p=>p.setAttribute('tabindex',p===point?'0':'-1'));show(Number(point.dataset.analyticsPoint));});
    point.addEventListener('blur',scheduleHide);
    point.addEventListener('keydown',event=>{
      if(event.key==='Escape'){hide();event.preventDefault();return;}
      if(['Enter',' '].includes(event.key)){show(Number(point.dataset.analyticsPoint));event.preventDefault();return;}
      let target;
      if(['ArrowRight','ArrowDown'].includes(event.key))target=Math.min(points.length-1,index+1);
      else if(['ArrowLeft','ArrowUp'].includes(event.key))target=Math.max(0,index-1);
      else if(event.key==='Home')target=0;
      else if(event.key==='End')target=points.length-1;
      if(target!=null){event.preventDefault();points[target].focus();}
    });
  });
}
