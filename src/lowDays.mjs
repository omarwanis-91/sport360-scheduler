import { addDays, datesBetween, holidayAppliesToProfile, publicHolidayForProfile, scheduleFor } from "./scheduleLogic.mjs";

const cairoCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"
});
export function cairoDate(now = new Date()) {
  const parts = Object.fromEntries(cairoCalendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function lowDayStatus(credit, today = cairoDate()) {
  if (credit.replacementDate) return credit.replacementDate < today ? "taken" : "booked";
  if (credit.dueDate < today) return "overdue";
  return credit.dueDate <= addDays(today, 7) ? "due" : "open";
}

export function canConfirmWorkedDay(state, profileId, date, today = cairoDate()) {
  if (date > today || state.lowDayCredits?.some((credit) => credit.profileId === profileId && credit.workedDate === date)) return false;
  const shift = scheduleFor(state, profileId, date);
  if (shift.id === "low_day") return false;
  return ["weekend", "vacation", "sick"].includes(shift.id) || shift.rotationStatus?.id === "weekend"
    || Boolean(publicHolidayForProfile(state, profileId, date));
}

export function availableReplacementDates(state, credit, today = cairoDate()) {
  const firstDay = addDays(credit.workedDate, 1);
  const start = firstDay > today ? firstDay : today;
  if (start > credit.dueDate || (credit.replacementDate && credit.replacementDate < today)) return [];
  return datesBetween(start, credit.dueDate).filter((date) => {
    if (date === credit.replacementDate) return true;
    if (publicHolidayForProfile(state, credit.profileId, date)) return false;
    if (state.lowDayCredits?.some((item) => item.profileId === credit.profileId && item.workedDate === date)) return false;
    const shift = scheduleFor(state, credit.profileId, date);
    return ["morning", "midday", "night"].includes(shift.id) && shift.kind === "working";
  });
}

export function confirmDemoLowDay(state, { profileId, date, statusId, note }) {
  if (!canConfirmWorkedDay(state, profileId, date) || !["morning", "midday", "night", "ground"].includes(statusId)) {
    throw new Error("Choose a working shift on an eligible day off or public holiday.");
  }
  const prior = state.scheduleOverrides.find((row) => row.profileId === profileId && row.date === date);
  const request = prior?.statusId === "vacation" && state.vacationRequests.find((item) =>
    item.profileId === profileId && item.status === "approved" && item.deductedDays > 0
    && date >= item.startDate && date <= item.endDate && prior.note === `Vacation request ${item.id}`);
  const year = Number(date.slice(0, 4));
  const charge = request?.deductedDaysByYear?.[year];
  const legacy = request && !Object.keys(request.deductedDaysByYear || {}).length;
  let refund;
  if (request && (legacy || charge > 0)) {
    const balance = state.annualBalances?.find((item) => item.profileId === profileId && item.year === year);
    if (!balance) throw new Error(`The Annual balance for ${year} is unavailable. Review it before overriding this leave.`);
    refund = {
      request: { ...request, deductedDays: request.deductedDays - 1,
        deductedDaysByYear: legacy ? request.deductedDaysByYear : { ...request.deductedDaysByYear, [year]: charge - 1 } },
      balance: { ...balance, remaining: balance.remaining + 1 }
    };
  }
  return {
    refund,
    credit: { id: crypto.randomUUID(), profileId, workedDate: date, dueDate: addDays(date, 30),
      workedStatusId: statusId, reason: publicHolidayForProfile(state, profileId, date) ? "public_holiday" : "day_off" },
    override: { id: prior?.id || crypto.randomUUID(), profileId, date, statusId,
      note: note.trim() || (!["weekend", "vacation", "sick"].includes(prior?.statusId) ? prior?.note : "") || "" }
  };
}

export function bookDemoLowDay(state, creditId, date) {
  const credit = state.lowDayCredits.find((item) => item.id === creditId);
  if (!credit || lowDayStatus(credit) === "taken") throw new Error("This credit cannot be changed.");
  if (!date && !credit.replacementDate) throw new Error("This credit has no booking.");
  if (date && !availableReplacementDates(state, credit).includes(date)) {
    throw new Error("Choose an eligible working day by the deadline.");
  }
  const prior = state.scheduleOverrides.find((row) => row.profileId === credit.profileId && row.date === date);
  if (date && date === credit.replacementDate) return { credit, override: prior };
  return {
    credit: { ...credit, replacementDate: date, priorOverride: prior || null },
    previousDate: credit.replacementDate,
    restoredOverride: credit.priorOverride,
    override: date ? { id: prior?.id || crypto.randomUUID(), profileId: credit.profileId, date,
      statusId: "low_day", note: `Worked ${credit.workedDate}` } : null
  };
}

export function saveDemoHoliday(state, holiday, remove) {
  if (remove) return state.publicHolidays.filter((item) => item.id !== holiday.id);
  const next = { ...holiday, id: holiday.id || crypto.randomUUID(), organizationWide: !holiday.departmentIds.length };
  if (state.publicHolidays.some((item) => item.date === next.date && item.id !== next.id)) {
    throw new Error("There is already a public holiday on this date. Edit that entry.");
  }
  const holidays = [...state.publicHolidays.filter((item) => item.id !== next.id), next];
  if (state.lowDayCredits.some((credit) => credit.replacementDate === next.date && next.date >= cairoDate()
    && publicHolidayForProfile({ ...state, publicHolidays: [next] }, credit.profileId, next.date))) {
    throw new Error("A replacement day is booked for this date. Reschedule it before saving the holiday.");
  }
  return holidays.sort((first, second) => first.date.localeCompare(second.date));
}

export function saveDemoHolidaySelection(state, { batchId, name, cells }, remove) {
  if (batchId && !state.publicHolidays.some((holiday) => holiday.batchId === batchId)) {
    throw new Error("This holiday is no longer available.");
  }
  const existing = state.publicHolidays.filter((holiday) => !batchId || holiday.batchId !== batchId);
  if (remove) return { holidays: existing, batchId };
  const selectedByDate = new Map();
  for (const { profileId, date } of cells) {
    if (existing.some((holiday) => holiday.date === date && holiday.dayOff && holidayAppliesToProfile(state, holiday, profileId))) {
      throw new Error("A selected shift already has a public holiday. Review the existing holiday first.");
    }
    if (date >= cairoDate() && state.lowDayCredits.some((credit) => credit.profileId === profileId && credit.replacementDate === date)) {
      throw new Error("A replacement day is booked on a selected shift. Reschedule it first.");
    }
    if (!selectedByDate.has(date)) selectedByDate.set(date, new Set());
    selectedByDate.get(date).add(profileId);
  }
  const batch = batchId || crypto.randomUUID();
  const saved = [...selectedByDate].map(([date, profileIds]) => ({
    id: crypto.randomUUID(), batchId: batch, date, name, dayOff: true,
    organizationWide: false, departmentIds: [], profileIds: [...profileIds]
  }));
  return { holidays: [...existing, ...saved].sort((first, second) => first.date.localeCompare(second.date)), batchId: batch };
}
