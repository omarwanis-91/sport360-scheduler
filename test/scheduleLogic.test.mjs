import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applyExplicitLeadDays,
  applyRotationDrafts,
  rotationFutureVersions,
  annualEligibleDates,
  datesBetween,
  departmentLeadForDate,
  isAnnualEligibleSchedule,
  isoWeekInfo,
  latestRotationForProfile,
  roleForProfile,
  sanitizeRotationPattern,
  scheduleFor,
  weekdayIndex,
  weeklyLeadPattern,
  workdayCount
} from "../src/scheduleLogic.mjs";

const rotationStatusIds = ["morning", "midday", "night", "weekend"];
const defaultWeekPattern = ["morning", "morning", "morning", "morning", "morning", "weekend", "weekend"];

test("future rotation review identifies blank Lead cutoffs and Apply onward preserves other people", () => {
  const state = { rotationVersions: [
    { id: "old", profileId: "a", effectiveStart: "2026-11-08", pattern: Array(7).fill("night") },
    { id: "other", profileId: "b", effectiveStart: "2026-11-08", pattern: Array(7).fill("morning") }
  ], departmentLeadRotations: [
    { id: "blank", departmentId: "ops", effectiveStart: "2026-11-08", pattern: ["", "b", "", "", "", "", ""] }
  ] };
  const change = { profileId: "a", effectiveStart: "2026-11-01", pattern: [...defaultWeekPattern], leadDays: [true, false, false, false, false, false, false] };
  const future = rotationFutureVersions(state, "ops", change);
  assert.equal(future.rotations[0].id, "old"); assert.equal(future.leads[0].id, "blank");
  assert.deepEqual(rotationFutureVersions(state, "ops", { ...change, preserveLeads: true }).leads, []);
  const after = applyRotationDrafts(state, "ops", [{ ...change, futurePolicy: "replace" }]);
  assert.equal(after.rotationVersions.some(row => row.id === "old"), false);
  assert.deepEqual(after.rotationVersions.find(row => row.id === "other"), state.rotationVersions[1]);
  assert.deepEqual(weeklyLeadPattern(after.departmentLeadRotations, "ops", "2026-11-09"), ["a", "b", "", "", "", "", ""]);
  const later = { ...change, profileId: "b", effectiveStart: "2026-11-15", futurePolicy: "replace" };
  const mixed = applyRotationDrafts(state, "ops", [{ ...change, futurePolicy: "replace" }, later]);
  assert.equal(weeklyLeadPattern(mixed.departmentLeadRotations, "ops", "2026-11-16")[0], "b");
});

test("rotation drafts preserve stored history, resolve dates, and move Lead earlier without stopping it at the old date", () => {
  const state = { rotationVersions: [
    { id: "first", profileId: "p1", effectiveStart: "2026-11-10", pattern: [...defaultWeekPattern] },
    { id: "untouched", profileId: "p2", effectiveStart: "2026-01-01", pattern: [...defaultWeekPattern] }
  ], departmentLeadRotations: [{ id: "lead", departmentId: "ops", effectiveStart: "2026-11-10", pattern: ["p1", "p2", "", "", "", "", ""] }] };
  const original = structuredClone(state);
  const preview = applyRotationDrafts(state, "ops", [{ profileId: "p1", action: "move", sourceVersionId: "first",
    sourceEffectiveStart: "2026-11-10", effectiveStart: "2026-11-01", pattern: [...defaultWeekPattern], leadDays: [true, false, false, false, false, false, false] }]);
  assert.deepEqual(state, original);
  assert.equal(preview.rotationVersions[0].effectiveStart, "2026-11-01");
  assert.equal(weeklyLeadPattern(preview.departmentLeadRotations, "ops", "2026-11-05")[0], "p1");
  assert.equal(weeklyLeadPattern(preview.departmentLeadRotations, "ops", "2026-11-12")[0], "p1");
  assert.equal(weeklyLeadPattern(preview.departmentLeadRotations, "ops", "2026-11-12")[1], "p2");
  const changed = applyRotationDrafts(state, "ops", [{ profileId: "p1", pattern: Array(7).fill("night"), leadDays: Array(7).fill(false), preserveLeads: true }], "2026-12-01");
  assert.deepEqual(changed.departmentLeadRotations, original.departmentLeadRotations);
  assert.deepEqual(changed.rotationVersions.find(row => row.id === "untouched"), original.rotationVersions[1]);
  assert.equal(changed.rotationVersions.at(-1).effectiveStart, "2026-12-01");
});

function testState() {
  return {
    statuses: [
      { id: "morning", label: "Morning", kind: "working" },
      { id: "midday", label: "Mid-day", kind: "working" },
      { id: "night", label: "Night", kind: "working" },
      { id: "weekend", label: "Weekend", kind: "off" },
      { id: "vacation", label: "Vacation", kind: "leave" },
      { id: "sick", label: "Sick", kind: "leave" },
      { id: "ground", label: "On Ground", kind: "working" }
    ],
    departments: [
      { id: "ops", name: "Operations" },
      { id: "ops-edit", name: "Editing", parentDepartmentId: "ops" }
    ],
    users: [
      { id: "user-lead", role: "lead" },
      { id: "user-fallback", role: "employee" }
    ],
    userRoles: [
      { userId: "user-lead", role: "admin" }
    ],
    rotationVersions: [
      { id: "old", profileId: "emp-1", effectiveStart: "2026-05-01", pattern: defaultWeekPattern },
      { id: "new", profileId: "emp-1", effectiveStart: "2026-05-20", pattern: ["night", "night", "night", "night", "night", "weekend", "weekend"] }
    ],
    scheduleOverrides: [
      { id: "ovr-1", profileId: "emp-1", date: "2026-05-21", statusId: "vacation", note: "Approved request" },
      { id: "ovr-2", profileId: "emp-1", date: "2026-05-22", statusId: "ground", note: "On site" },
      { id: "ovr-3", profileId: "emp-1", date: "2026-05-25", statusId: "sick", note: "Sick day" }
    ],
    profiles: [
      { id: "lead-weekday", departmentId: "ops", leadEligible: true },
      { id: "lead-weekend", departmentId: "ops", leadEligible: true },
      { id: "not-eligible", departmentId: "ops", leadEligible: false },
      { id: "hybrid-member", departmentId: "support", departmentIds: ["support", "ops"], leadEligible: false }
    ],
    departmentLeads: [
      { id: "daily", departmentId: "ops", date: "2026-05-23", profileId: "lead-weekday" }
    ],
    departmentLeadRotations: [
      {
        id: "lead-rotation",
        departmentId: "ops",
        effectiveStart: "2026-05-01",
        pattern: ["lead-weekday", "lead-weekday", "lead-weekday", "lead-weekday", "lead-weekday", "lead-weekend", "lead-weekend"]
      }
    ]
  };
}

test("date helpers use local calendar days", () => {
  assert.equal(addDays("2026-05-31", 1), "2026-06-01");
  assert.equal(weekdayIndex("2026-06-01"), 0);
  assert.deepEqual(datesBetween("2026-06-01", "2026-06-03"), ["2026-06-01", "2026-06-02", "2026-06-03"]);
});

test("unassigned weekly leads stay empty and explicit choices preserve other people", () => {
  const empty = weeklyLeadPattern([], 'ops', '2026-11-08');
  assert.deepEqual(empty, Array(7).fill(''));
  const assigned = applyExplicitLeadDays(empty, 'person', [true, false, false, false, false, false, false]);
  assert.deepEqual(assigned, ['person', '', '', '', '', '', '']);
  const another = applyExplicitLeadDays(assigned, 'other', [false, true, false, false, false, false, false]);
  assert.deepEqual(another, ['person', 'other', '', '', '', '', '']);
  assert.deepEqual(applyExplicitLeadDays(another, 'person', Array(7).fill(false)), ['', 'other', '', '', '', '', '']);
  assert.deepEqual(weeklyLeadPattern([{ departmentId: 'ops', effectiveStart: '2027-01-01', pattern: assigned }], 'ops', '2026-11-08'), empty);
});

test("ISO week labels stay correct across year boundaries", () => {
  assert.deepEqual(isoWeekInfo("2026-01-01"), { week: 1, year: 2026 });
  assert.deepEqual(isoWeekInfo("2027-01-01"), { week: 53, year: 2026 });
});

test("rotation patterns reject non-rotational statuses", () => {
  assert.deepEqual(
    sanitizeRotationPattern(["morning", "vacation", "sick"], rotationStatusIds, defaultWeekPattern),
    ["morning", "weekend", "weekend", "morning", "weekend", "weekend", "morning"]
  );
});

test("schedule uses latest effective rotation and keeps override context", () => {
  const state = testState();
  assert.equal(latestRotationForProfile(state.rotationVersions, "emp-1").id, "new");
  assert.equal(scheduleFor(state, "emp-1", "2026-05-20").id, "night");

  const vacation = scheduleFor(state, "emp-1", "2026-05-21");
  assert.equal(vacation.id, "vacation");
  assert.equal(vacation.source, "Override");
  assert.equal(vacation.rotationStatus.id, "night");
});

test("workday count includes working exceptions and excludes leave/off days", () => {
  assert.equal(workdayCount(testState(), "emp-1", "2026-05-20", "2026-05-24"), 2);
});

test("annual eligibility excludes Weekend, Sick, and existing Annual without excluding On Ground", () => {
  const state = testState();
  assert.deepEqual(
    annualEligibleDates(state, "emp-1", "2026-05-20", "2026-05-25"),
    ["2026-05-20", "2026-05-22"]
  );
  assert.equal(isAnnualEligibleSchedule(scheduleFor(state, "emp-1", "2026-05-21")), false);
  assert.equal(isAnnualEligibleSchedule(scheduleFor(state, "emp-1", "2026-05-23")), false);
  assert.equal(isAnnualEligibleSchedule(scheduleFor(state, "emp-1", "2026-05-25")), false);
  assert.equal(isAnnualEligibleSchedule(scheduleFor(state, "emp-1", "2026-05-22")), true);
});

test("role lookup prefers stored user role, falls back to user, then unclaimed", () => {
  const state = testState();
  assert.equal(roleForProfile(state, { userId: "user-lead" }), "admin");
  assert.equal(roleForProfile(state, { userId: "user-fallback" }), "employee");
  assert.equal(roleForProfile(state, { userId: null }), "unclaimed");
});

test("department lead uses daily override before the effective weekly rotation", () => {
  const state = testState();
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-22").profile.id, "lead-weekday");
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-23").source, "Daily override");
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-24").profile.id, "lead-weekend");
});

test("any department member can be assigned as day lead", () => {
  const state = testState();
  state.departmentLeads.push({ id: "any-member", departmentId: "ops", date: "2026-05-25", profileId: "not-eligible" });
  state.departmentLeads.push({ id: "hybrid", departmentId: "ops", date: "2026-05-26", profileId: "hybrid-member" });

  assert.equal(departmentLeadForDate(state, "ops", "2026-05-25").profile.id, "not-eligible");
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-26").profile.id, "hybrid-member");
});

test("parent department leads accept members assigned to descendant departments", () => {
  const state = testState();
  state.profiles.push({ id: "child-member", departmentId: "ops-edit", departmentIds: ["ops-edit"] });
  state.departmentLeads.push({ id: "parent-daily", departmentId: "ops", date: "2026-05-27", profileId: "child-member" });
  state.departmentLeadRotations.push({
    id: "parent-rotation",
    departmentId: "ops",
    effectiveStart: "2026-05-27",
    pattern: Array(7).fill("child-member")
  });

  assert.equal(departmentLeadForDate(state, "ops", "2026-05-27").profile.id, "child-member");
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-27").source, "Daily override");
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-28").profile.id, "child-member");
  assert.equal(departmentLeadForDate(state, "ops", "2026-05-28").source, "Lead rotation");
});
