import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  datesBetween,
  departmentLeadForDate,
  latestRotationForProfile,
  roleForProfile,
  sanitizeRotationPattern,
  scheduleFor,
  weekdayIndex,
  workdayCount
} from "../src/scheduleLogic.mjs";

const rotationStatusIds = ["morning", "midday", "night", "weekend"];
const defaultWeekPattern = ["morning", "morning", "morning", "morning", "morning", "weekend", "weekend"];

function testState() {
  return {
    statuses: [
      { id: "morning", label: "Morning", kind: "working" },
      { id: "midday", label: "Mid-day", kind: "working" },
      { id: "night", label: "Night", kind: "working" },
      { id: "weekend", label: "Weekend", kind: "off" },
      { id: "vacation", label: "Vacation", kind: "leave" },
      { id: "ground", label: "On Ground", kind: "working" }
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
      { id: "ovr-2", profileId: "emp-1", date: "2026-05-22", statusId: "ground", note: "On site" }
    ],
    profiles: [
      { id: "lead-weekday", departmentId: "ops", leadEligible: true },
      { id: "lead-weekend", departmentId: "ops", leadEligible: true },
      { id: "not-eligible", departmentId: "ops", leadEligible: false }
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
