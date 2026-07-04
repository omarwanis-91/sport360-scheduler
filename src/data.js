export const seedState = {
  currentUserId: "user-admin",
  statuses: [
    { id: "morning", label: "Morning", color: "#2f80ed", kind: "working" },
    { id: "night", label: "Night", color: "#5b45d8", kind: "working" },
    { id: "midday", label: "Mid-day", color: "#d97706", kind: "working" },
    { id: "weekend", label: "Weekend", color: "#64748b", kind: "off" },
    { id: "vacation", label: "Vacation", color: "#0ea5e9", kind: "leave" },
    { id: "sick", label: "Sick", color: "#dc2626", kind: "leave" },
    { id: "ground", label: "On Ground", color: "#14b8a6", kind: "working" }
  ],
  departments: [
    { id: "ops", name: "Operations" },
    { id: "support", name: "Customer Support" },
    { id: "field", name: "Field Team" }
  ],
  users: [
    { id: "user-admin", email: "admin@company.test", role: "admin", profileId: "emp-001" },
    { id: "user-lead", email: "mona@company.test", role: "lead", profileId: "emp-002" },
    { id: "user-employee", email: "youssef@company.test", role: "employee", profileId: "emp-004" }
  ],
  profiles: [
    {
      id: "emp-001",
      employeeId: "SCH-001",
      email: "admin@company.test",
      name: "Omar Wanis",
      title: "Workforce Admin",
      seniorityLevel: "manager",
      leadEligible: true,
      departmentId: "ops",
      departmentIds: ["ops"],
      photo: "",
      yearlyVacationDays: 24,
      remainingVacationDays: 22,
      userId: "user-admin"
    },
    {
      id: "emp-002",
      employeeId: "SCH-014",
      email: "mona@company.test",
      name: "Mona Saleh",
      title: "Department Lead",
      seniorityLevel: "lead",
      leadEligible: true,
      departmentId: "ops",
      departmentIds: ["ops"],
      photo: "",
      yearlyVacationDays: 24,
      remainingVacationDays: 19,
      userId: "user-lead"
    },
    {
      id: "emp-003",
      employeeId: "SCH-018",
      email: "karim@company.test",
      name: "Karim Adel",
      title: "Scheduler",
      seniorityLevel: "senior",
      leadEligible: true,
      departmentId: "ops",
      departmentIds: ["ops"],
      photo: "",
      yearlyVacationDays: 21,
      remainingVacationDays: 16,
      userId: null
    },
    {
      id: "emp-004",
      employeeId: "SCH-022",
      email: "youssef@company.test",
      name: "Youssef Nabil",
      title: "Agent",
      seniorityLevel: "mid",
      leadEligible: true,
      departmentId: "support",
      departmentIds: ["support"],
      photo: "",
      yearlyVacationDays: 21,
      remainingVacationDays: 18,
      userId: "user-employee"
    },
    {
      id: "emp-005",
      employeeId: "SCH-031",
      email: "layla@company.test",
      name: "Layla Hassan",
      title: "Field Specialist",
      seniorityLevel: "senior",
      leadEligible: true,
      departmentId: "field",
      departmentIds: ["field"],
      photo: "",
      yearlyVacationDays: 21,
      remainingVacationDays: 21,
      userId: null
    }
  ],
  rotationVersions: [
    {
      id: "rot-001",
      profileId: "emp-001",
      effectiveStart: "2026-05-01",
      pattern: ["morning", "morning", "night", "night", "morning", "weekend", "weekend"]
    },
    {
      id: "rot-002",
      profileId: "emp-002",
      effectiveStart: "2026-05-01",
      pattern: ["morning", "morning", "morning", "midday", "night", "night", "weekend"]
    },
    {
      id: "rot-003",
      profileId: "emp-003",
      effectiveStart: "2026-05-01",
      pattern: ["night", "night", "weekend", "morning", "morning", "weekend", "weekend"]
    },
    {
      id: "rot-004",
      profileId: "emp-004",
      effectiveStart: "2026-05-01",
      pattern: ["morning", "weekend", "night", "night", "weekend", "morning", "weekend"]
    },
    {
      id: "rot-005",
      profileId: "emp-005",
      effectiveStart: "2026-05-01",
      pattern: ["ground", "ground", "weekend", "morning", "night", "weekend", "weekend"]
    }
  ],
  scheduleOverrides: [
    { id: "ovr-001", profileId: "emp-002", date: "2026-05-20", statusId: "midday", note: "Ramadan pilot shift" },
    { id: "ovr-002", profileId: "emp-004", date: "2026-05-18", statusId: "sick", note: "Medical leave" }
  ],
  departmentLeads: [
    { id: "lead-001", departmentId: "ops", date: "2026-05-16", profileId: "emp-002" },
    { id: "lead-002", departmentId: "support", date: "2026-05-16", profileId: "emp-004" },
    { id: "lead-003", departmentId: "field", date: "2026-05-16", profileId: "emp-005" }
  ],
  departmentLeadRotations: [
    {
      id: "lead-rot-001",
      departmentId: "ops",
      effectiveStart: "2026-05-01",
      pattern: ["emp-002", "emp-002", "emp-002", "emp-002", "emp-002", "emp-003", "emp-003"]
    },
    {
      id: "lead-rot-002",
      departmentId: "support",
      effectiveStart: "2026-05-01",
      pattern: ["emp-004", "emp-004", "emp-004", "emp-004", "emp-004", "emp-004", "emp-004"]
    },
    {
      id: "lead-rot-003",
      departmentId: "field",
      effectiveStart: "2026-05-01",
      pattern: ["emp-005", "emp-005", "emp-005", "emp-005", "emp-005", "emp-005", "emp-005"]
    }
  ],
  vacationRequests: [
    {
      id: "vac-001",
      profileId: "emp-003",
      startDate: "2026-05-22",
      endDate: "2026-05-24",
      reason: "Family travel",
      status: "pending",
      requestedAt: "2026-05-15T10:00:00.000Z",
      decidedBy: null,
      decidedAt: null,
      deductedDays: 0
    }
  ],
  auditLog: [
    {
      id: "aud-001",
      actorId: "user-admin",
      action: "seed.created",
      entityType: "system",
      entityId: "demo",
      createdAt: "2026-05-16T00:00:00.000Z",
      detail: "Demo schedule initialized"
    }
  ]
};
