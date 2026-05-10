export const appConfig = {
  appName: "Shift Loom",
  defaultMonth: { year: 2026, month: 3 },
  vacationLimit: 15,
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  defaultDayOrder: [1, 2, 3, 4, 5, 6, 0],
  requestTypes: [
    { id: "vacation", label: "Vacation", shiftTypeId: "vacation" },
    { id: "sick", label: "Sick Leave", shiftTypeId: "sick" }
  ]
};

export const emptyScheduleData = {
  departments: [],
  shiftTypes: [],
  people: [],
  defaults: [],
  overrides: [],
  managerDefaults: [],
  managerOverrides: [],
  requests: [],
  profiles: []
};
