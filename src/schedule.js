import { appConfig } from "./config.js";

export function indexBy(items, key) {
  return Object.fromEntries(items.map((item) => [item[key], item]));
}

export function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function visibleDayCount() {
  return window.innerWidth < 900 ? 4 : 7;
}

export function visibleDays(state) {
  const total = getDaysInMonth(state.year, state.month);
  const count = visibleDayCount();
  const start = Math.min(Math.max(state.dayStart || 1, 1), Math.max(1, total - count + 1));
  return Array.from({ length: Math.min(count, total) }, (_, index) => start + index);
}

export function shiftDayWindow(state, delta) {
  const maxStart = Math.max(1, getDaysInMonth(state.year, state.month) - visibleDayCount() + 1);
  state.dayStart = Math.min(Math.max(1, state.dayStart + delta), maxStart);
}

export function todayIsoKey(offsetDays = 0) {
  const today = new Date();
  today.setDate(today.getDate() + offsetDays);
  return today.toISOString().slice(0, 10);
}

export function isTodayInView(state, day) {
  const today = new Date();
  return today.getFullYear() === state.year && today.getMonth() === state.month && today.getDate() === day;
}

export function normalizeData(data) {
  const departmentsById = indexBy(data.departments, "id");
  const shiftsById = indexBy(data.shiftTypes, "id");
  const defaultsByPerson = {};
  const overridesByKey = {};
  const managerDefaultsByKey = {};
  const managerOverridesByKey = {};

  data.defaults.forEach((item) => {
    defaultsByPerson[item.person_id] ||= {};
    defaultsByPerson[item.person_id][item.weekday] = item.shift_type_id;
  });

  data.overrides.forEach((item) => {
    overridesByKey[overrideKey(item.person_id, item.shift_date)] = item.shift_type_id;
  });

  data.managerDefaults.forEach((item) => {
    managerDefaultsByKey[managerKey(item.department_id, item.weekday)] = item.person_id || "";
  });

  data.managerOverrides.forEach((item) => {
    managerOverridesByKey[managerKey(item.department_id, item.manager_date)] = item.person_id || "";
  });

  const defaultShift = data.shiftTypes.find((shift) => shift.default_eligible)?.id || data.shiftTypes[0]?.id || "morning";
  const people = data.people.map((person) => ({
    ...person,
    department: departmentsById[person.department_id],
    profile: data.profiles.find((profile) => profile.person_id === person.id) || null,
    defaults: appConfig.weekdays.map((_, weekday) => defaultsByPerson[person.id]?.[weekday] || defaultShift)
  }));

  return {
    ...data,
    departmentsById,
    shiftsById,
    people,
    overridesByKey,
    managerDefaultsByKey,
    managerOverridesByKey
  };
}

export function overrideKey(personId, isoDate) {
  return `${personId}:${isoDate}`;
}

export function managerKey(departmentId, dayOrDate) {
  return `${departmentId}:${dayOrDate}`;
}

export function getShiftId(data, person, year, month, day) {
  const isoDate = dateKey(year, month, day);
  const override = data.overridesByKey[overrideKey(person.id, isoDate)];
  const weekday = new Date(year, month, day).getDay();
  return override || person.defaults[weekday] || data.shiftTypes[0]?.id;
}

export function vacationCount(data, person, year, month) {
  return Array.from({ length: getDaysInMonth(year, month) }, (_, index) => index + 1)
    .filter((day) => {
      const shift = data.shiftsById[getShiftId(data, person, year, month, day)];
      return shift?.counts_as_vacation;
    }).length;
}

export function vacationRemaining(data, person, year, month) {
  return Math.max(0, Number(person.vacation_limit || 0) - vacationCount(data, person, year, month));
}

export function dayOverrideCount(data, year, month, day) {
  const isoDate = dateKey(year, month, day);
  return data.overrides.filter((override) => override.shift_date === isoDate).length
    + data.managerOverrides.filter((override) => override.manager_date === isoDate).length;
}

export function getManager(data, departmentId, year, month, day) {
  const isoDate = dateKey(year, month, day);
  const weekday = new Date(year, month, day).getDay();
  return data.managerOverridesByKey[managerKey(departmentId, isoDate)]
    || data.managerDefaultsByKey[managerKey(departmentId, weekday)]
    || "";
}

export function managedDepartments(data, personId, year, month, day) {
  return data.departments
    .filter((department) => department.manager_enabled && getManager(data, department.id, year, month, day) === personId)
    .map((department) => department.name);
}

export function peopleByDepartment(data, departmentId) {
  return data.people
    .filter((person) => person.active && person.department_id === departmentId)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
}

export function managerScore(data, person, days, year, month) {
  return days.reduce((score, day) => score + managedDepartments(data, person.id, year, month, day).length, 0);
}

export function datesInRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
