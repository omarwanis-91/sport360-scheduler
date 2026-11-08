const cairoYear = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', year: 'numeric' });
export const annualYear = (now = new Date()) => Number(cairoYear.format(now));

export function annualCharges(dates) {
  return dates.reduce((years, date) => {
    const year = Number(date.slice(0, 4));
    years[year] = (years[year] || 0) + 1;
    return years;
  }, {});
}

// Production performs these operations in PostgreSQL. These helpers mirror them for demo/preview.
export function syncDemoAnnualBalances(state, now = new Date()) {
  const year = annualYear(now);
  const initializing = !state.annualBalances;
  state.annualBalances ||= [];
  for (const profile of state.profiles) {
    profile.annualBalanceYear ||= year;
    let balance = state.annualBalances.find(b => b.profileId === profile.id && b.year === profile.annualBalanceYear);
    if (!balance) {
      balance = { profileId: profile.id, year: profile.annualBalanceYear, allowance: profile.yearlyVacationDays, remaining: profile.remainingVacationDays, source: 'opening' };
      state.annualBalances.push(balance);
    }
    Object.assign(balance, { allowance: profile.yearlyVacationDays, remaining: profile.remainingVacationDays });
    if (initializing) {
      const legacyDates = (state.scheduleOverrides || []).filter(o => o.profileId === profile.id && o.statusId === 'vacation'
        && Number(o.date.slice(0,4)) > profile.annualBalanceYear && state.vacationRequests?.some(r =>
          r.profileId === profile.id && r.status === 'approved' && o.note === `Vacation request ${r.id}`)).map(o => o.date);
      for (const [futureYear, days] of Object.entries(annualCharges(legacyDates))) {
        if (days > profile.yearlyVacationDays) throw new Error('Already approved future Annual exceeds the saved allowance.');
        state.annualBalances.push({ profileId: profile.id, year: Number(futureYear), allowance: profile.yearlyVacationDays,
          remaining: profile.yearlyVacationDays - days, source: 'advance' });
      }
    }
    for (const future of state.annualBalances.filter(b => b.profileId === profile.id && b.year > profile.annualBalanceYear)) {
      const remaining = future.remaining + profile.yearlyVacationDays - future.allowance;
      if (remaining < 0) throw new Error('Allowance cannot be lower than already approved future-year Annual.');
      Object.assign(future, { allowance: profile.yearlyVacationDays, remaining });
    }
    for (let next = profile.annualBalanceYear + 1; next <= year; next++) {
      let renewal = state.annualBalances.find(b => b.profileId === profile.id && b.year === next);
      if (!renewal) {
        renewal = { profileId: profile.id, year: next, allowance: profile.yearlyVacationDays, remaining: profile.yearlyVacationDays, source: 'renewal' };
        state.annualBalances.push(renewal);
      }
      renewal.source = 'renewal';
      Object.assign(profile, { annualBalanceYear: next, remainingVacationDays: renewal.remaining });
      state.auditLog ||= [];
      state.auditLog.push({ id: `annual-renewal:${profile.id}:${next}`, actorId: null, action: 'annual.year_renewed',
        entityType: 'profile', entityId: profile.id, detail: `${next}: ${renewal.remaining}/${renewal.allowance} Annual days`, createdAt: now.toISOString() });
    }
  }
  return state;
}

export function annualBalanceImpact(state, profile, dates, charges = annualCharges(dates)) {
  const currentYear = profile.annualBalanceYear || annualYear();
  return Object.entries(charges).map(([yearText, days]) => {
    const year = Number(yearText);
    const saved = state.annualBalances?.find(b => b.profileId === profile.id && b.year === year);
    const before = saved?.remaining ?? (year === currentYear ? profile.remainingVacationDays : year > currentYear ? profile.yearlyVacationDays : null);
    return { year, days, before, after: before === null ? null : before - days };
  });
}

export function deductDemoAnnual(state, profile, dates) {
  const impact = annualBalanceImpact(state, profile, dates);
  if (!dates.length) throw new Error('No eligible working days remain in this annual request.');
  const invalid = impact.find(part => part.after === null || part.after < 0);
  if (invalid) throw new Error(`Insufficient or unavailable Annual balance for ${invalid.year}.`);
  state.annualBalances ||= [];
  for (const part of impact) {
    let balance = state.annualBalances.find(b => b.profileId === profile.id && b.year === part.year);
    if (!balance) {
      balance = { profileId: profile.id, year: part.year, allowance: profile.yearlyVacationDays, remaining: part.before, source: 'advance' };
      state.annualBalances.push(balance);
    }
    balance.remaining = part.after;
    if (part.year === profile.annualBalanceYear) profile.remainingVacationDays = part.after;
  }
  return annualCharges(dates);
}
