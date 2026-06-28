import { seedState } from "./data.js";
import { appConfig } from "./config.js";
import { createSupabaseStore } from "./supabaseStore.js";
import {
  addDays as addDaysLogic,
  byId,
  dateDiff as dateDiffLogic,
  datesBetween as datesBetweenLogic,
  departmentLeadForDate as departmentLeadForDateLogic,
  latestRotationForProfile as latestRotationForProfileLogic,
  normalizeWeekPattern as normalizeWeekPatternLogic,
  parseDate as parseDateLogic,
  roleForProfile as roleForProfileLogic,
  sanitizeRotationPattern as sanitizeRotationPatternLogic,
  scheduleFor as scheduleForLogic,
  toIso as toIsoLogic,
  weekdayIndex as weekdayIndexLogic,
  workdayCount as workdayCountLogic
} from "./scheduleLogic.mjs";

const storageKey = "sport360-scheduler-state";
const todayIso = toIso(new Date());

const icons = {
  scheduler: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
  requests: '<svg viewBox="0 0 24 24"><path d="M7 11h10M7 15h6"/><path d="M5 4h14v16H5z"/><path d="m9 7 1.5 1.5L14 5"/></svg>',
  people: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  departments: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>',
  rotations: '<svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  activity: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06A2 2 0 1 1 7.13 4.2l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.22.35.43.68.6 1H20a2 2 0 1 1 0 4h-.1c-.17.32-.38.65-.6 1Z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M20 16v4H4v-4"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 13.2A8.5 8.5 0 1 1 10.8 3a6.5 6.5 0 0 0 10.2 10.2Z"/></svg>',
  midday: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M4.5 12h3M16.5 12h3"/><circle cx="12" cy="12" r="4"/><path d="M5 19 19 5"/></svg>',
  weekend: '<svg viewBox="0 0 24 24"><path d="M7 8h10v10H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  vacation: '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 20c3-6 9-9 14-10"/><path d="M7 12c2-5 5-8 8-9 1 3 0 7-3 10"/></svg>',
  sick: '<svg viewBox="0 0 24 24"><path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/></svg>',
  ground: '<svg viewBox="0 0 24 24"><path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  lead: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88Z"/></svg>'
};

const statusIcons = {
  morning: icons.sun,
  night: icons.moon,
  midday: icons.midday,
  weekend: icons.weekend,
  vacation: icons.vacation,
  sick: icons.sick,
  ground: icons.ground
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaultWeekPattern = ["morning", "morning", "morning", "morning", "morning", "weekend", "weekend"];
const rotationStatusIds = ["morning", "midday", "night", "weekend"];
const exceptionStatusIds = ["vacation", "sick", "ground"];
const seniorityLevels = [
  ["junior", "Junior"],
  ["mid", "Mid-level"],
  ["senior", "Senior"],
  ["lead", "Lead"],
  ["manager", "Manager"]
];

let dataStore;
let state = structuredClone(seedState);
let coverageTargets = loadCoverageTargets();
let rotationPresets = loadRotationPresets();
const ui = {
  activeView: "scheduler",
  selectedDepartmentId: state.departments[0]?.id,
  peopleDepartmentId: "all",
  peopleView: "default",
  rangeDays: appConfig.defaultScheduleDays,
  startDate: todayIso,
  calendarMonth: todayIso.slice(0, 7),
  profileViewId: null,
  selectedFilter: "all",
  requestFilter: "pending",
  activityType: "all",
  activitySearch: "",
  hierarchyDepartmentIds: state.departments.map((department) => department.id),
  rotationDepartmentEdit: false,
  selectedRotationProfileIds: [],
  rotationBulkEditing: false,
  rotationBulkPattern: [...defaultWeekPattern],
  rotationBulkEffectiveStart: todayIso,
  pendingPhotoFile: null,
  pendingPhotoDataUrl: "",
  drawer: null,
  loading: true,
  error: "",
  notice: "",
  noticeKind: "info",
  mutation: { key: "", status: "idle", message: "" }
};

function notify(message, kind = "info") {
  ui.notice = message;
  ui.noticeKind = kind;
  render();
}

function isMutationPending() {
  return ui.mutation.status === "pending";
}

async function runMutation(key, messages, action) {
  if (isMutationPending()) return { ok: false };
  if (dataStore?.mode === "supabase" && !navigator.onLine) {
    notify("You appear to be offline. Reconnect, then try again.", "error");
    return { ok: false };
  }
  ui.mutation = { key, status: "pending", message: messages.pending };
  ui.notice = messages.pending;
  ui.noticeKind = "info";
  render();
  try {
    const result = await action();
    ui.mutation = { key, status: "success", message: messages.success };
    notify(messages.success, "success");
    return { ok: true, result };
  } catch (error) {
    const message = error.message || messages.failure;
    ui.mutation = { key, status: "error", message };
    notify(message, "error");
    return { ok: false, error };
  }
}

function loadState() {
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : structuredClone(seedState);
}

function loadCoverageTargets() {
  const stored = localStorage.getItem("sport360-coverage-targets");
  return stored ? JSON.parse(stored) : {};
}

function saveCoverageTargets() {
  localStorage.setItem("sport360-coverage-targets", JSON.stringify(coverageTargets));
}

function loadRotationPresets() {
  const stored = localStorage.getItem("sport360-rotation-presets");
  return stored ? JSON.parse(stored).map((preset) => ({ ...preset, pattern: sanitizeRotationPattern(preset.pattern) })) : [];
}

function saveRotationPresets() {
  localStorage.setItem("sport360-rotation-presets", JSON.stringify(rotationPresets));
}

function rotationStatuses() {
  return rotationStatusIds.map((id) => byId(state.statuses, id)).filter(Boolean);
}

function exceptionStatuses() {
  return exceptionStatusIds.map((id) => byId(state.statuses, id)).filter(Boolean);
}

function dailyStatusGroups() {
  return [
    { label: "Rotation shifts", statuses: rotationStatuses() },
    { label: "Daily exceptions", statuses: exceptionStatuses() }
  ];
}

function sanitizeRotationPattern(pattern) {
  return sanitizeRotationPatternLogic(pattern, rotationStatusIds, defaultWeekPattern);
}

async function saveState() {
  await dataStore.persist(state);
}

function syncHierarchyDepartmentSelection() {
  const departmentIds = state.departments.map((department) => department.id);
  const valid = new Set(departmentIds);
  const selected = (ui.hierarchyDepartmentIds || []).filter((departmentId) => valid.has(departmentId));
  ui.hierarchyDepartmentIds = selected.length ? selected : departmentIds;
}

async function resetDemo() {
  await dataStore.reset();
  location.reload();
}

function makeId(prefix) {
  if (dataStore?.mode === "supabase" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseDate(iso) {
  return parseDateLogic(iso);
}

function toIso(date) {
  return toIsoLogic(date);
}

function addDays(iso, amount) {
  return addDaysLogic(iso, amount);
}

function addMonths(monthIso, amount) {
  const [year, month] = monthIso.split("-").map(Number);
  return toIso(new Date(year, month - 1 + amount, 1)).slice(0, 7);
}

function dateDiff(startIso, endIso) {
  return dateDiffLogic(startIso, endIso);
}

function weekdayIndex(iso) {
  return weekdayIndexLogic(iso);
}

function formatDay(iso) {
  return parseDate(iso).toLocaleDateString("en-US", { weekday: "short" });
}

function formatDate(iso) {
  return parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthYear(iso) {
  return parseDate(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function datesInRange() {
  return Array.from({ length: ui.rangeDays }, (_, index) => addDays(ui.startDate, index));
}

function schedulerRangeClass() {
  if (ui.rangeDays >= 30) return "range-month";
  if (ui.rangeDays >= 14) return "range-two-weeks";
  return "range-week";
}

function zoomScheduleRange(direction) {
  const ranges = [7, 14, 30];
  const currentIndex = Math.max(0, ranges.indexOf(ui.rangeDays));
  const nextIndex = Math.min(ranges.length - 1, Math.max(0, currentIndex + direction));
  ui.rangeDays = ranges[nextIndex];
}

function schedulerMonthLabel(dates) {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "";
  const firstLabel = formatMonthYear(first);
  const lastLabel = formatMonthYear(last);
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} - ${lastLabel}`;
}

function datesBetween(startIso, endIso) {
  return datesBetweenLogic(startIso, endIso);
}

function currentUser() {
  return byId(state.users, state.currentUserId);
}

function currentProfile() {
  return byId(state.profiles, currentUser()?.profileId);
}

function roleForProfile(profile) {
  return roleForProfileLogic(state, profile);
}

function profileDepartmentIds(profile) {
  return [profile?.departmentId, ...(profile?.departmentIds || [])]
    .filter((departmentId, index, values) => departmentId && values.indexOf(departmentId) === index);
}

function profileDepartmentNames(profile) {
  return profileDepartmentIds(profile).map((id) => byId(state.departments, id)?.name).filter(Boolean);
}

function profileBelongsToDepartment(profile, departmentId) {
  return profileDepartmentIds(profile).includes(departmentId);
}

function selectedHierarchyDepartments() {
  const selected = new Set(ui.hierarchyDepartmentIds || []);
  return state.departments.filter((department) => selected.has(department.id));
}

function hierarchyProfilesForDepartment(departmentId) {
  return state.profiles.filter((profile) => profileBelongsToDepartment(profile, departmentId));
}

function departmentProfiles() {
  let profiles = state.profiles.filter((profile) => profileBelongsToDepartment(profile, ui.selectedDepartmentId));
  if (ui.selectedFilter === "leads") {
    const leadIds = new Set(state.departmentLeads.filter((lead) => lead.departmentId === ui.selectedDepartmentId).map((lead) => lead.profileId));
    profiles = profiles.filter((profile) => leadIds.has(profile.id));
  }
  if (ui.selectedFilter === "unclaimed") profiles = profiles.filter((profile) => !profile.userId);
  if (ui.selectedFilter === "vacation") {
    profiles = profiles.filter((profile) => datesInRange().some((date) => scheduleFor(profile.id, date).id === "vacation"));
  }
  return profiles;
}

function canEditPast() {
  return currentUser()?.role === "admin";
}

function isAdmin() {
  return currentUser()?.role === "admin";
}

function isLead() {
  return currentUser()?.role === "lead";
}

function canManageSystemSettings() {
  return isAdmin();
}

function canManageProfiles() {
  return isAdmin();
}

function canManageDepartments() {
  return isAdmin();
}

function canManageDepartment(departmentId) {
  const user = currentUser();
  if (isAdmin()) return true;
  if (!isLead()) return false;
  return byId(state.profiles, user.profileId)?.departmentId === departmentId;
}

function canEditProfile(profile) {
  return canManageProfiles() || currentProfile()?.id === profile?.id;
}

function canRequestVacationFor(profile) {
  if (!profile) return false;
  return isAdmin() || canManageDepartment(profile.departmentId) || currentProfile()?.id === profile.id;
}

function requestableProfiles() {
  return state.profiles.filter(canRequestVacationFor);
}

function visibleVacationRequests() {
  return state.vacationRequests.filter((request) => {
    const profile = byId(state.profiles, request.profileId);
    if (!profile) return false;
    return isAdmin() || canManageDepartment(profile.departmentId) || currentProfile()?.id === profile.id;
  });
}

function vacationRequestsForProfile(profileId) {
  return visibleVacationRequests()
    .filter((request) => request.profileId === profileId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function vacationRequestForDate(profileId, date, status = "pending") {
  return state.vacationRequests.find((request) =>
    request.profileId === profileId
    && request.status === status
    && request.startDate <= date
    && request.endDate >= date
  );
}

function isPastDate(iso) {
  return parseDate(iso) < parseDate(todayIso);
}

function editableDate(iso) {
  return canEditPast() || !isPastDate(iso);
}

function activeRotation(profileId, dateIso) {
  return latestRotationForProfileLogic(
    state.rotationVersions.filter((rotation) => rotation.effectiveStart <= dateIso),
    profileId
  );
}

function leadCandidates(departmentId) {
  return state.profiles.filter((profile) => profileBelongsToDepartment(profile, departmentId));
}

function latestLeadRotation(departmentId) {
  return (state.departmentLeadRotations || [])
    .filter((rotation) => rotation.departmentId === departmentId)
    .sort((a, b) => b.effectiveStart.localeCompare(a.effectiveStart))[0];
}

function departmentLeadForDate(departmentId, dateIso) {
  return departmentLeadForDateLogic(state, departmentId, dateIso);
}

function scheduleFor(profileId, dateIso) {
  return scheduleForLogic(state, profileId, dateIso);
}

function workdayCount(profileId, startIso, endIso) {
  return workdayCountLogic(state, profileId, startIso, endIso);
}

function coverageForDate(profiles, date) {
  return profiles.reduce((coverage, profile) => {
    const schedule = scheduleFor(profile.id, date);
    if (schedule.id === "ground") coverage.away += 1;
    else if (schedule.kind === "working") coverage.available += 1;
    else coverage.unavailable += 1;
    return coverage;
  }, { available: 0, unavailable: 0, away: 0 });
}

function coverageGroupsForDate(profiles, date) {
  return profiles.reduce((groups, profile) => {
    const schedule = scheduleFor(profile.id, date);
    const entry = { profile, schedule };
    if (schedule.id === "ground") groups.away.push(entry);
    else if (schedule.kind === "working") groups.available.push(entry);
    else groups.unavailable.push(entry);
    return groups;
  }, { available: [], unavailable: [], away: [] });
}

function coverageCountForStatusIds(statusIds) {
  return statusIds.reduce((coverage, statusId) => {
    const status = byId(state.statuses, statusId);
    if (status?.id === "ground") coverage.away += 1;
    else if (status?.kind === "working") coverage.available += 1;
    else coverage.unavailable += 1;
    return coverage;
  }, { available: 0, unavailable: 0, away: 0 });
}

function audit(action, entityType, entityId, detail) {
  const entry = {
    id: makeId("aud"),
    actorId: currentUser()?.id,
    action,
    entityType,
    entityId,
    detail,
    createdAt: new Date().toISOString()
  };
  state.auditLog.unshift(entry);
  if (dataStore?.mode === "supabase") void dataStore.insertAudit(entry);
}

function avatar(profile) {
  if (!profile) return "<span>?</span>";
  if (profile.photo) return `<img src="${profile.photo}" alt="">`;
  return `<span>${profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>`;
}

function render() {
  const app = document.querySelector("#app");
  if (ui.loading) {
    app.innerHTML = `<main class="auth-shell"><div class="auth-card"><span class="eyebrow">Sport360 Scheduler</span><h1>Loading scheduler</h1><p>Preparing the workspace.</p></div></main>`;
    return;
  }

  if (ui.error && dataStore?.mode === "supabase" && dataStore.session) {
    app.innerHTML = `
      <main class="auth-shell">
        <div class="auth-card">
          <span class="eyebrow">Sport360 Scheduler</span>
          <h1>Live data could not load</h1>
          <p class="form-error">${ui.error}</p>
          <button class="primary wide" id="retry-live-load">Retry</button>
          <button class="ghost wide" id="sign-out">Sign out</button>
        </div>
      </main>
    `;
    document.querySelector("#retry-live-load")?.addEventListener("click", reloadState);
    document.querySelector("#sign-out")?.addEventListener("click", signOut);
    return;
  }

  if (dataStore?.mode === "supabase" && !dataStore.session) {
    app.innerHTML = renderAuth();
    bindAuthEvents();
    applyMutationPendingUi();
    return;
  }

  try {
    app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">S</div>
        <div>
          <strong>Sport360</strong>
          <span>Scheduler</span>
        </div>
      </div>
      <nav>
        ${navButton("me", "My Profile", icons.people)}
        ${navButton("scheduler", "Scheduler", icons.scheduler)}
        ${navButton("requests", "Requests", icons.requests)}
        ${navButton("people", "People", icons.people)}
        ${navButton("hierarchy", "Hierarchy", icons.departments)}
        ${navButton("departments", "Departments", icons.departments)}
        ${navButton("rotations", "Rotations", icons.rotations)}
        ${navButton("activity", "Activity", icons.activity)}
        ${navButton("settings", "Settings", icons.settings)}
      </nav>
      ${dataStore.mode === "demo" ? `
        <div class="sidebar-card">
          <span class="eyebrow">Demo Access</span>
          <select id="user-switcher">
            ${state.users.map((user) => `<option value="${user.id}" ${state.currentUserId === user.id ? "selected" : ""}>${user.role.toUpperCase()} - ${user.email}</option>`).join("")}
          </select>
        </div>
        <button class="ghost wide" id="reset-demo">Reset demo data</button>
      ` : `
        <div class="sidebar-card">
          <span class="eyebrow">Live Supabase</span>
          <p class="hint">${currentUser()?.email || "Signed in"}</p>
          <button class="ghost wide" id="sign-out">Sign out</button>
        </div>
      `}
      <div class="user-tile">
        <div class="avatar">${avatar(currentProfile())}</div>
        <div>
          <strong>${currentProfile()?.name || "Unclaimed user"}</strong>
          <span>${currentUser()?.role || "guest"}</span>
        </div>
      </div>
    </aside>
    <main class="workspace">
      ${renderActiveView()}
      ${renderAppNotice()}
    </main>
    ${renderDrawer()}
  `;
    bindEvents();
    focusAppShell();
  } catch (error) {
    showFatalError(error);
  }
}

function focusAppShell() {
  const app = document.querySelector("#app");
  const activeTag = document.activeElement?.tagName;
  if (!app || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(activeTag)) return;
  requestAnimationFrame(() => app.focus({ preventScroll: true }));
}

document.querySelector("#page-focus-sentinel")?.addEventListener("focus", () => {
  requestAnimationFrame(() => {
    document.querySelector("[data-view]")?.focus({ preventScroll: true });
  });
});

function showFatalError(error) {
  document.querySelector("#app").innerHTML = `
    <main class="auth-shell">
      <div class="auth-card">
        <span class="eyebrow">Sport360 Scheduler</span>
        <h1>Workspace needs a refresh</h1>
        <p class="form-error">${error.message || "The app could not finish loading this view."}</p>
        <button class="primary wide" id="retry-live-load">Reload Data</button>
        <button class="ghost wide" id="sign-out">Sign out</button>
      </div>
    </main>
  `;
  document.querySelector("#retry-live-load")?.addEventListener("click", reloadState);
  document.querySelector("#sign-out")?.addEventListener("click", signOut);
}

function renderAppNotice() {
  if (!ui.notice || (dataStore?.mode === "supabase" && !dataStore.session)) return "";
  return `
    <div class="app-notice ${ui.noticeKind || "info"}" role="status">
      <span>${ui.notice}</span>
      <button type="button" class="icon-button" id="dismiss-notice">${icons.close}</button>
    </div>
  `;
}

function renderAuth() {
  return `
    <main class="auth-shell">
      <form class="auth-card" id="auth-form">
        <div class="brand auth-brand">
          <div class="brand-mark">S</div>
          <div><strong>Sport360</strong><span>Scheduler</span></div>
        </div>
        <div>
          <span class="eyebrow">Supabase Sign In</span>
          <h1>${appConfig.allowSignup ? "Claim your schedule profile" : "Sign in to your schedule"}</h1>
          <p>${appConfig.allowSignup ? "Use the same email that was created on your employee profile." : "Access is created by your Sport360 administrator. Use your assigned work email."}</p>
        </div>
        ${ui.error ? `<p class="form-error">${ui.error}</p>` : ""}
        ${ui.notice ? `<p class="form-notice">${ui.notice}</p>` : ""}
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary wide" name="intent" value="sign-in">Sign In</button>
        ${appConfig.allowSignup ? `<button class="ghost wide" name="intent" value="sign-up">Create Account</button>` : ""}
        <p class="hint">${appConfig.allowSignup ? "After sign-in, the app links your account to the unclaimed profile with the same email." : "If your access is not ready, contact your administrator instead of creating another account."}</p>
      </form>
    </main>
  `;
}

function navButton(id, label, icon) {
  return `<button class="nav-item ${ui.activeView === id ? "active" : ""}" data-view="${id}">${icon}<span>${label}</span></button>`;
}

function renderActiveView() {
  if (ui.activeView === "me") return renderMyProfile();
  if (ui.activeView === "profile-page") return renderProfilePage();
  if (ui.activeView === "requests") return renderRequests();
  if (ui.activeView === "people") return renderPeople();
  if (ui.activeView === "hierarchy") return renderHierarchy();
  if (ui.activeView === "departments") return renderDepartments();
  if (ui.activeView === "rotations") return renderRotations();
  if (ui.activeView === "activity") return renderActivity();
  if (ui.activeView === "settings") return renderSettings();
  return renderScheduler();
}

function renderMyProfile() {
  const profile = currentProfile();
  if (!profile) {
    return `
      ${renderTopbar("My Profile", "This account has not claimed a profile yet.", "")}
      <section class="empty-state">
        <strong>No linked profile</strong>
        <span>Ask an admin to create a profile using your sign-in email, then sign in again to claim it.</span>
      </section>
    `;
  }
  const department = byId(state.departments, profile.departmentId);
  const departmentSummary = profileDepartmentNames(profile).join(", ") || "No department";
  const upcoming = datesInRange().slice(0, 7);
  return `
    ${renderTopbar("My Profile", "Your profile, vacation balance, and upcoming shifts.", `<button class="primary" data-open-drawer="profile" data-profile-id="${profile.id}">Edit My Profile</button>`)}
    <section class="my-profile-layout">
      <div class="my-profile-side">
        ${renderProfileHero(profile)}
        ${renderProfileQuickStats(profile)}
        ${renderProfileInfoCards(profile, "compact")}
      <template>
      <article class="my-profile-hero">
        <div class="avatar xlarge">${avatar(profile)}</div>
        <div>
          <span class="eyebrow">${roleForProfile(profile)}</span>
          <h2>${profile.name}</h2>
          <p>${profile.title} · ${department?.name || "No department"}</p>
        </div>
      </article>
      </template>
      <section class="list-panel my-shifts">
        <span class="eyebrow">Upcoming</span>
        ${upcoming.map((date) => {
          const status = scheduleFor(profile.id, date);
          return `
            <button class="request-row ${status.id}" data-open-drawer="calendar-day" data-profile-id="${profile.id}" data-date="${date}">
              <span class="shift-icon">${statusIcons[status.id] || icons.scheduler}</span>
              <div>
                <strong>${formatDay(date)} ${formatDate(date)}</strong>
                <span>${status.label} · ${status.source}</span>
              </div>
            </button>
          `;
        }).join("")}
      </section>
      </div>
      ${renderPersonMonthCalendar(profile, "page")}
    </section>
  `;
}

function renderProfilePage() {
  const profile = byId(state.profiles, ui.profileViewId) || currentProfile();
  if (!profile) return renderMyProfile();
  const department = byId(state.departments, profile.departmentId);
  const departmentSummary = profileDepartmentNames(profile).join(", ") || "No department";
  const vacationRequests = vacationRequestsForProfile(profile.id).slice(0, 6);
  const upcoming = datesInRange().slice(0, 7);
  const actions = `
    <div class="top-actions">
      <button class="ghost" data-view="scheduler">Back to Scheduler</button>
      ${canEditProfile(profile) ? `<button class="primary" data-open-drawer="profile" data-profile-id="${profile.id}">Edit Profile</button>` : ""}
    </div>
  `;
  return `
    ${renderTopbar(profile.name, `${profile.title} · ${departmentSummary}`, actions)}
    <section class="profile-page-layout">
      <aside class="profile-page-side">
        ${renderProfileHero(profile)}
        ${renderProfileQuickStats(profile)}
        <template>
        <article class="my-profile-hero">
          <div class="avatar xlarge">${avatar(profile)}</div>
          <div>
            <span class="eyebrow">${profile.userId ? roleForProfile(profile) : "Unclaimed"}</span>
            <h2>${profile.name}</h2>
            <p>${profile.employeeId} Â· ${profile.email}</p>
          </div>
        </article>
        <div class="detail-line"><span>Department</span><strong>${department?.name || "No department"}</strong></div>
        <div class="detail-line"><span>Vacation</span><strong>${profile.remainingVacationDays} / ${profile.yearlyVacationDays}</strong></div>
        <div class="detail-line"><span>Claiming</span><strong>${profile.userId ? "Account linked" : "Waiting"}</strong></div>
        </template>
        <section class="list-panel my-shifts">
          <span class="eyebrow">Upcoming</span>
          ${upcoming.map((date) => {
            const status = scheduleFor(profile.id, date);
            return `
              <button class="request-row ${status.id}" data-open-drawer="calendar-day" data-profile-id="${profile.id}" data-date="${date}">
                <span class="shift-icon">${statusIcons[status.id] || icons.scheduler}</span>
                <div>
                  <strong>${formatDay(date)} ${formatDate(date)}</strong>
                  <span>${status.label} Â· ${status.source}</span>
                </div>
              </button>
            `;
          }).join("")}
        </section>
      </aside>
      <div class="profile-page-main">
        ${renderPersonMonthCalendar(profile, "page")}
        ${renderProfileInfoCards(profile)}
        <section class="list-panel">
          <span class="eyebrow">Vacation Requests</span>
          ${vacationRequests.length ? vacationRequests.map((request) => `
            <button class="vacation-mini ${request.status}" data-open-drawer="request-detail" data-request-id="${request.id}">
              <strong>${request.status}</strong>
              <span>${request.startDate} to ${request.endDate}</span>
            </button>
          `).join("") : `<p class="hint">No vacation requests for this employee yet.</p>`}
        </section>
      </div>
    </section>
  `;
}

function renderProfileHero(profile) {
  const departments = profileDepartmentNames(profile);
  const departmentSummary = departments.join(", ") || "No department";
  const role = profile.userId ? roleForProfile(profile) : "unclaimed";
  return `
    <article class="profile-hero-card">
      <div class="avatar xlarge">${avatar(profile)}</div>
      <div>
        <span class="eyebrow">${role}</span>
        <h2>${profile.name}</h2>
        <p>${profile.employeeId} - ${profile.title} - ${departmentSummary}</p>
        <div class="profile-tags">
          <span>${role}</span>
          <span>${profile.userId ? "claimed" : "unclaimed"}</span>
          ${departments.length ? departments.map((department) => `<span>${department}</span>`).join("") : `<span>no department</span>`}
        </div>
      </div>
    </article>
  `;
}

function renderProfileQuickStats(profile) {
  const monthStart = `${ui.calendarMonth}-01`;
  const monthEnd = `${addMonths(ui.calendarMonth, 1)}-01`;
  const monthDates = datesBetween(monthStart, addDays(monthEnd, -1));
  const monthSchedules = monthDates.map((date) => scheduleFor(profile.id, date));
  const workDays = monthSchedules.filter((schedule) => schedule.kind === "working" && schedule.id !== "ground").length;
  const leaveDays = monthSchedules.filter((schedule) => schedule.kind === "leave").length;
  const manualDays = monthDates.filter((date) => scheduleFor(profile.id, date).source === "Override").length;
  return `
    <div class="profile-stat-grid">
      <article><span>Vacation</span><strong>${profile.remainingVacationDays}</strong><em>of ${profile.yearlyVacationDays}</em></article>
      <article><span>Work days</span><strong>${workDays}</strong><em>${parseDate(monthStart).toLocaleDateString("en-US", { month: "short" })}</em></article>
      <article><span>Leave</span><strong>${leaveDays}</strong><em>${manualDays} manual</em></article>
    </div>
  `;
}

function renderProfileInfoCards(profile, density = "regular") {
  const departmentSummary = profileDepartmentNames(profile).join(", ") || "None";
  const role = profile.userId ? roleForProfile(profile) : "Unclaimed";
  const rotation = latestRotationForProfile(profile.id);
  const nextWorkingDate = datesBetween(todayIso, addDays(todayIso, 30)).find((date) => {
    const schedule = scheduleFor(profile.id, date);
    return schedule.kind === "working" && schedule.id !== "ground";
  });
  const nextWorkingSchedule = nextWorkingDate ? scheduleFor(profile.id, nextWorkingDate) : null;
  const requests = vacationRequestsForProfile(profile.id);
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  return `
    <section class="profile-info-grid ${density}">
      <article class="profile-info-card">
        <div class="profile-card-head"><span>Departments</span><em>${departmentSummary}</em></div>
        <strong>${profile.title}</strong>
        <small>${profile.email}</small>
      </article>
      <article class="profile-info-card">
        <div class="profile-card-head"><span>Access</span><em>${profile.userId ? "linked" : "waiting"}</em></div>
        <strong>${role}</strong>
        <small>${profile.userId ? "Sign-in account is connected." : "Can claim with matching email."}</small>
      </article>
      <article class="profile-info-card">
        <div class="profile-card-head"><span>Rotation</span><em>${rotation?.effectiveStart || "none"}</em></div>
        <strong>${rotation ? "Weekly pattern active" : "No rotation"}</strong>
        <small>${nextWorkingDate ? `Next work: ${formatDay(nextWorkingDate)} ${formatDate(nextWorkingDate)} - ${nextWorkingSchedule.label}` : "No work days in next 30 days."}</small>
      </article>
      <article class="profile-info-card">
        <div class="profile-card-head"><span>Leave / PTO</span><em>${pendingRequests} pending</em></div>
        <strong>${profile.remainingVacationDays} days left</strong>
        <small>${requests.length ? `${requests.length} total requests visible.` : "No vacation requests yet."}</small>
      </article>
    </section>
  `;
}

function renderPersonMonthCalendar(profile, placement = "drawer") {
  const monthStart = `${ui.calendarMonth}-01`;
  const firstOffset = weekdayIndex(monthStart);
  const monthEnd = `${addMonths(ui.calendarMonth, 1)}-01`;
  const daysInMonth = dateDiff(monthStart, monthEnd);
  const cells = [
    ...Array.from({ length: firstOffset }, () => ""),
    ...Array.from({ length: daysInMonth }, (_, index) => addDays(monthStart, index))
  ];
  const title = parseDate(monthStart).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthSchedules = cells.filter(Boolean).map((date) => scheduleFor(profile.id, date));
  const workingDays = monthSchedules.filter((schedule) => schedule.kind === "working" && schedule.id !== "ground").length;
  const leaveDays = monthSchedules.filter((schedule) => schedule.kind === "leave").length;
  const manualDays = cells.filter(Boolean).filter((date) => scheduleFor(profile.id, date).source === "Override").length;
  return `
    <section class="person-calendar ${placement}">
      <div class="calendar-head">
        <div>
          <span class="eyebrow">Month View</span>
          <strong>${title}</strong>
        </div>
        <div class="calendar-nav">
          <button type="button" class="icon-button" data-calendar-prev title="Previous month">${icons.chevron}</button>
          <button type="button" class="ghost" data-calendar-today>Today</button>
          <button type="button" class="icon-button next" data-calendar-next title="Next month">${icons.chevron}</button>
        </div>
      </div>
      <div class="calendar-metrics">
        <span><strong>${workingDays}</strong> work days</span>
        <span><strong>${leaveDays}</strong> leave days</span>
        <span><strong>${manualDays}</strong> manual</span>
      </div>
      <div class="month-grid">
        ${weekDays.map((day) => `<span class="month-weekday">${day}</span>`).join("")}
        ${cells.map((date) => date ? renderCalendarDay(profile, date) : `<span class="month-day empty"></span>`).join("")}
      </div>
      <div class="calendar-legend">
        <span><i class="legend-dot working"></i>Work</span>
        <span><i class="legend-dot off"></i>Off</span>
        <span><i class="legend-dot leave"></i>Leave</span>
        <span><i class="legend-ring"></i>Manual</span>
      </div>
    </section>
  `;
}

function renderCalendarDay(profile, date) {
  const schedule = scheduleFor(profile.id, date);
  const pendingVacation = vacationRequestForDate(profile.id, date, "pending");
  const approvedVacation = vacationRequestForDate(profile.id, date, "approved");
  const isSelected = ui.drawer?.type === "calendar-day"
    && ui.drawer.profileId === profile.id
    && ui.drawer.date === date;
  const sourceClass = schedule.source.toLowerCase().replace(/\s+/g, "-");
  const dayClass = schedule.id === "ground" ? "away" : schedule.kind;
  const weekendClass = weekdayIndex(date) >= 5 ? "weekend-day" : "";
  const calendarClass = `month-day ${dayClass} ${schedule.id} ${sourceClass} ${weekendClass} ${date === todayIso ? "today" : ""} ${pendingVacation ? "pending" : ""} ${isSelected ? "selected" : ""}`;
  return `
    <button type="button" class="${calendarClass}" data-open-drawer="calendar-day" data-profile-id="${profile.id}" data-date="${date}" aria-pressed="${isSelected}" title="${schedule.label} - ${schedule.source}">
      <span>${parseDate(date).getDate()}</span>
      ${date === todayIso ? `<small class="today-label">Today</small>` : ""}
      <em>${statusIcons[schedule.id] || icons.scheduler}</em>
      ${pendingVacation ? `<i class="day-marker pending"></i>` : ""}
      ${approvedVacation ? `<i class="day-marker approved"></i>` : ""}
    </button>
  `;
}

function renderTopbar(title, subtitle, action = "") {
  return `
    <header class="topbar">
      <div>
        <span class="eyebrow">Sport360 Scheduler</span>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      ${action}
    </header>
  `;
}

function renderScheduler() {
  const dates = datesInRange();
  const profiles = departmentProfiles();
  const department = byId(state.departments, ui.selectedDepartmentId);
  if (!department) {
    return renderTopbar("No Departments", "Create at least one department in Supabase before building schedules.", "");
  }
  const action = `
    <div class="top-actions">
      <select id="department-select">
        ${state.departments.map((item) => `<option value="${item.id}" ${item.id === ui.selectedDepartmentId ? "selected" : ""}>${item.name}</option>`).join("")}
      </select>
      <button class="ghost icon-button" id="zoom-in-range" title="Zoom in">${icons.plus}</button>
      <select id="range-select" title="Schedule zoom">
        <option value="7" ${ui.rangeDays === 7 ? "selected" : ""}>1 Week</option>
        <option value="14" ${ui.rangeDays === 14 ? "selected" : ""}>2 Weeks</option>
        <option value="30" ${ui.rangeDays === 30 ? "selected" : ""}>1 Month</option>
      </select>
      <button class="ghost icon-button" id="zoom-out-range" title="Zoom out">${icons.minus}</button>
      <button class="ghost" id="prev-range">Previous</button>
      <button class="ghost" id="today-range">Today</button>
      <button class="ghost" id="next-range">Next</button>
      ${canManageProfiles() ? `<button class="primary" data-open-drawer="profile">${icons.plus} New Profile</button>` : ""}
    </div>
  `;

  return `
    ${renderTopbar(department.name, "Hybrid schedule board with employees on rows and dates across the timeline.", action)}
    <section class="control-row">
      ${filterButton("all", "All people")}
      ${filterButton("leads", "Leads")}
      ${filterButton("unclaimed", "Unclaimed")}
      ${filterButton("vacation", "On vacation")}
    </section>
    <section class="scheduler-shell">
      <div class="schedule-grid ${schedulerRangeClass()}" style="--days: ${dates.length}">
        <div class="month-corner"></div>
        <div class="scheduler-month-bar">
          <button class="ghost icon-button" id="month-prev-range" title="Previous range">${icons.chevron}</button>
          <strong>${schedulerMonthLabel(dates)}</strong>
          <button class="ghost icon-button" id="month-next-range" title="Next range">${icons.chevron}</button>
        </div>
        <div class="employee-head">
          <span>People</span>
          <strong>${profiles.length} profiles</strong>
        </div>
        ${dates.map((date) => renderDateHead(date)).join("")}
        ${renderCoverageRow(profiles, dates, department)}
        ${profiles.map((profile) => renderProfileRow(profile, dates)).join("")}
      </div>
    </section>
  `;
}

function renderCoverageRow(profiles, dates, department) {
  const target = coverageTargetForDepartment(department);
  return `
    <div class="coverage-head">
      <span>Coverage</span>
      <strong>${target} target</strong>
    </div>
    ${dates.map((date) => {
      const coverage = coverageForDate(profiles, date);
      const isLow = coverage.available < target;
      return `
        <button class="coverage-cell ${isLow ? "low" : ""}" data-open-drawer="coverage" data-date="${date}">
          <span class="coverage-count">${coverage.available}</span>
          <span class="coverage-meta">avail</span>
          <small>${coverage.unavailable} off · ${coverage.away} ground</small>
        </button>
      `;
    }).join("")}
  `;
}

function filterButton(id, label) {
  return `<button class="segment ${ui.selectedFilter === id ? "active" : ""}" data-filter="${id}">${label}</button>`;
}

function requestFilterButton(id, label, count) {
  return `<button class="segment ${ui.requestFilter === id ? "active" : ""}" data-request-filter="${id}">${label}<span>${count}</span></button>`;
}

function peopleViewButton(id, label) {
  return `<button class="segment ${ui.peopleView === id ? "active" : ""}" data-people-view="${id}">${label}</button>`;
}

function coverageTargetForDepartment(department) {
  return Number(department?.coverageTarget ?? coverageTargets[department?.id] ?? 1);
}

function renderDateHead(date) {
  const lead = departmentLeadForDate(ui.selectedDepartmentId, date);
  const isToday = date === todayIso;
  return `
    <button class="date-head ${isToday ? "today" : ""}" data-open-drawer="lead" data-date="${date}">
      <span>${formatDay(date)}${isToday ? `<small>Today</small>` : ""}</span>
      <strong>${formatDate(date)}</strong>
      <em>${lead.profile ? `Lead: ${lead.profile.name.split(" ")[0]}` : "No lead"}</em>
    </button>
  `;
}

function renderProfileRow(profile, dates) {
  return `
    <button class="employee-cell" data-open-drawer="person" data-profile-id="${profile.id}">
      <div class="avatar">${avatar(profile)}</div>
      <div>
        <strong>${profile.name}</strong>
        <span>${profile.title} · ${profile.remainingVacationDays} vac days</span>
      </div>
    </button>
    ${dates.map((date) => renderShiftCell(profile, date)).join("")}
  `;
}

function renderShiftCell(profile, date) {
  const status = scheduleFor(profile.id, date);
  const pendingVacation = vacationRequestForDate(profile.id, date, "pending");
  const lead = departmentLeadForDate(ui.selectedDepartmentId, date);
  const isDayLead = lead.profile?.id === profile.id;
  const icon = statusIcons[status.id] || icons.scheduler;
  const availabilityState = status.id === "ground" ? "state-away" : status.kind === "working" ? "state-working" : "state-off";
  const availabilityLabel = availabilityState === "state-working" ? "Available" : "Unavailable";
  const sourceClass = status.source.toLowerCase().replace(/\s+/g, "-");
  return `
    <button class="shift-cell ${availabilityState} source-${sourceClass} ${pendingVacation ? "has-pending-vacation" : ""} ${isDayLead ? "is-day-lead" : ""} ${status.id}" data-open-drawer="shift" data-profile-id="${profile.id}" data-date="${date}" title="${isDayLead ? "Department lead - " : ""}${profile.name}, ${formatDate(date)}, ${status.label}">
      <span class="shift-icon">${icon}</span>
      ${isDayLead ? `<span class="lead-marker" aria-label="Department lead">${icons.lead}</span>` : ""}
      <span class="shift-label">${status.label}</span>
      <small><span class="availability-badge">${availabilityLabel}</span>${status.source}</small>
      ${pendingVacation ? `<span class="cell-alert">Pending vacation</span>` : ""}
    </button>
  `;
}

function renderRequests() {
  const requests = visibleVacationRequests();
  const filteredRequests = ui.requestFilter === "all" ? requests : requests.filter((request) => request.status === ui.requestFilter);
  const canCreateRequest = requestableProfiles().length > 0;
  const pending = requests.filter((request) => request.status === "pending").length;
  const approved = requests.filter((request) => request.status === "approved").length;
  const rejected = requests.filter((request) => request.status === "rejected").length;
  return `
    ${renderTopbar("Vacation Requests", `${pending} pending approvals. Approved requests deduct scheduled work days only.`, canCreateRequest ? `<button class="primary" data-open-drawer="request">${icons.plus} New Request</button>` : "")}
    <section class="control-row request-filters">
      ${requestFilterButton("pending", "Pending", pending)}
      ${requestFilterButton("approved", "Approved", approved)}
      ${requestFilterButton("rejected", "Rejected", rejected)}
      ${requestFilterButton("all", "All", requests.length)}
    </section>
    <section class="list-panel">
      ${filteredRequests.length ? filteredRequests.map(renderRequestRow).join("") : `<div class="empty-state compact"><strong>No ${ui.requestFilter} requests</strong><span>Requests will appear here when they match this filter.</span></div>`}
    </section>
  `;
}

function renderRequestRow(request) {
  const profile = byId(state.profiles, request.profileId);
  const department = byId(state.departments, profile.departmentId);
  const days = request.status === "pending" ? workdayCount(profile.id, request.startDate, request.endDate) : request.deductedDays;
  return `
    <button class="request-row" data-open-drawer="request-detail" data-request-id="${request.id}">
      <div class="avatar">${avatar(profile)}</div>
      <div>
        <strong>${profile.name}</strong>
        <span>${department?.name || "Unassigned"} · ${request.startDate} to ${request.endDate}</span>
      </div>
      <mark class="${request.status}">${request.status}</mark>
      <em>${days} work days</em>
    </button>
  `;
}

function renderPeople() {
  const profiles = ui.peopleDepartmentId === "all"
    ? state.profiles
    : state.profiles.filter((profile) => profileBelongsToDepartment(profile, ui.peopleDepartmentId));
  const action = `
    <div class="top-actions">
      <div class="people-view-switch">
        ${peopleViewButton("default", "Default")}
        ${peopleViewButton("kanban", "Kanban")}
        ${peopleViewButton("list", "List")}
        ${peopleViewButton("tiles", "Tiles")}
      </div>
      <select id="people-department-select">
        <option value="all" ${ui.peopleDepartmentId === "all" ? "selected" : ""}>All departments</option>
        ${state.departments.map((department) => `<option value="${department.id}" ${ui.peopleDepartmentId === department.id ? "selected" : ""}>${department.name}</option>`).join("")}
      </select>
      ${canManageProfiles() ? `<button class="primary" data-open-drawer="profile">${icons.plus} New Profile</button>` : ""}
    </div>
  `;
  return `
    ${renderTopbar("People", "Profiles exist before accounts. Matching verified emails claim created profiles.", action)}
    ${renderPeopleView(profiles)}
  `;
}

function renderPeopleView(profiles) {
  const selectedDepartment = ui.peopleDepartmentId === "all" ? null : byId(state.departments, ui.peopleDepartmentId);
  if (ui.peopleView === "kanban") return renderPeopleKanban(profiles, selectedDepartment);
  if (ui.peopleView === "list") return renderPeopleList(profiles);
  if (ui.peopleView === "tiles") return renderPeopleTiles(profiles);
  return renderPeopleDepartmentGroups(profiles, selectedDepartment);
}

function renderPeopleDepartmentGroups(profiles, selectedDepartment = null) {
  const departments = selectedDepartment ? [selectedDepartment] : state.departments;
  const groups = departments.map((department) => renderPeopleGroup(
    department?.name || "Department",
    profiles.filter((profile) => profileBelongsToDepartment(profile, department?.id)),
    department
  ));
  const unassigned = profiles.filter((profile) => !profileDepartmentIds(profile).some((id) => byId(state.departments, id)));
  if (!selectedDepartment && unassigned.length) groups.push(renderPeopleGroup("Unassigned", unassigned));
  return `<section class="people-department-stack">${groups.join("")}</section>`;
}

function peopleGroupsForView(profiles, selectedDepartment = null) {
  const departments = selectedDepartment ? [selectedDepartment] : state.departments;
  const groups = departments.map((department) => ({
    id: department?.id || "department",
    label: department?.name || "Department",
    department,
    profiles: profiles.filter((profile) => profileBelongsToDepartment(profile, department?.id))
  }));
  if (!selectedDepartment) {
    const unassigned = profiles.filter((profile) => !profileDepartmentIds(profile).some((id) => byId(state.departments, id)));
    if (unassigned.length) groups.push({ id: "unassigned", label: "Unassigned", department: null, profiles: unassigned });
  }
  return groups;
}

function renderPeopleKanban(profiles, selectedDepartment = null) {
  const groups = peopleGroupsForView(profiles, selectedDepartment);
  return `
    <section class="people-kanban">
      ${groups.map((group) => `
        <article class="people-kanban-column">
          <div class="people-kanban-head">
            <strong>${group.label}</strong>
            <mark>${group.profiles.length}</mark>
          </div>
          <div class="people-kanban-list">
            ${group.profiles.length ? group.profiles.map((profile) => renderPersonKanbanCard(profile, group.department)).join("") : `<div class="empty-state compact"><strong>No people</strong><span>Empty department.</span></div>`}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderPeopleList(profiles) {
  return `
    <section class="people-list-view">
      ${profiles.length ? profiles.map(renderPersonListRow).join("") : `<div class="empty-state compact"><strong>No people</strong><span>No profiles match this filter.</span></div>`}
    </section>
  `;
}

function renderPeopleTiles(profiles) {
  return `
    <section class="people-tile-grid">
      ${profiles.length ? profiles.map(renderPersonTile).join("") : `<div class="empty-state compact"><strong>No people</strong><span>No profiles match this filter.</span></div>`}
    </section>
  `;
}

function renderPeopleGroup(label, profiles, department = null) {
  return `
    <section class="people-department-group">
      <div class="people-department-head">
        <div>
          <span class="eyebrow">Department</span>
          <strong>${label}</strong>
        </div>
        <mark>${profiles.length} ${profiles.length === 1 ? "person" : "people"}</mark>
      </div>
      ${profiles.length ? `
        <div class="people-grid">
          ${profiles.map((profile) => renderPersonCard(profile, department)).join("")}
        </div>
      ` : `<div class="empty-state compact"><strong>No people here</strong><span>Add a member or assign an unassigned profile.</span></div>`}
    </section>
  `;
}

function renderPersonCard(profile, department = byId(state.departments, profile.departmentId)) {
  return `
    <button class="person-card" data-open-drawer="person" data-profile-id="${profile.id}">
      <div class="avatar large">${avatar(profile)}</div>
      <strong>${profile.name}</strong>
      <span>${profile.title}</span>
      <em class="department-name">${department?.name || "Unassigned"}</em>
      <mark class="${profile.userId ? "claimed" : "unclaimed"}">${profile.userId ? roleForProfile(profile) : "Unclaimed"}</mark>
    </button>
  `;
}

function renderPersonKanbanCard(profile, department = byId(state.departments, profile.departmentId)) {
  return `
    <button class="person-kanban-card" data-open-drawer="person" data-profile-id="${profile.id}">
      <div class="avatar">${avatar(profile)}</div>
      <div>
        <strong>${profile.name}</strong>
        <span>${profile.title}</span>
      </div>
      <mark class="${profile.userId ? "claimed" : "unclaimed"}">${profile.userId ? roleForProfile(profile) : "Unclaimed"}</mark>
    </button>
  `;
}

function renderPersonListRow(profile) {
  const department = byId(state.departments, profile.departmentId);
  return `
    <button class="person-list-row" data-open-drawer="person" data-profile-id="${profile.id}">
      <div class="avatar">${avatar(profile)}</div>
      <div class="person-list-name">
        <strong>${profile.name}</strong>
        <span>${profile.email}</span>
      </div>
      <span>${profile.title}</span>
      <em>${department?.name || "Unassigned"}</em>
      <mark class="${profile.userId ? "claimed" : "unclaimed"}">${profile.userId ? roleForProfile(profile) : "Unclaimed"}</mark>
      <small>${profile.remainingVacationDays}/${profile.yearlyVacationDays} days</small>
    </button>
  `;
}

function renderPersonTile(profile) {
  const department = byId(state.departments, profile.departmentId);
  return `
    <button class="person-tile" data-open-drawer="person" data-profile-id="${profile.id}">
      <div class="avatar">${avatar(profile)}</div>
      <div>
        <strong>${profile.name}</strong>
        <span>${profile.title}</span>
      </div>
      <em>${department?.name || "Unassigned"}</em>
    </button>
  `;
}

function renderDepartments() {
  const dates = datesInRange();
  return `
    ${renderTopbar("Departments", "Create departments, review team size, and jump into each schedule.", canManageDepartments() ? `<button class="primary" data-open-drawer="department">${icons.plus} New Department</button>` : "")}
    <section class="department-grid">
      ${state.departments.map((department) => renderDepartmentCard(department, dates)).join("")}
      <template>
      ${state.departments.map((department) => {
        const members = state.profiles.filter((profile) => profileBelongsToDepartment(profile, department.id));
        const leadCount = dates.filter((date) => departmentLeadForDate(department.id, date).profile).length;
        return `
          <button class="metric-card" data-open-drawer="department-detail" data-department-id="${department.id}">
            <span class="eyebrow">${department.name}</span>
            <strong>${members.length}</strong>
            <p>${coverageTargetForDepartment(department)} coverage target · ${leadCount}/${dates.length} leads this view</p>
          </button>
        `;
      }).join("")}
      </template>
    </section>
  `;
}

function departmentStats(department, dates = datesInRange()) {
  const members = state.profiles.filter((profile) => profileBelongsToDepartment(profile, department.id));
  const leadCount = dates.filter((date) => departmentLeadForDate(department.id, date).profile).length;
  const pendingRequests = state.vacationRequests.filter((request) => {
    const profile = byId(state.profiles, request.profileId);
    return profile?.departmentId === department.id && request.status === "pending";
  }).length;
  const rotations = state.rotationVersions.filter((rotation) => members.some((profile) => profile.id === rotation.profileId)).length;
  const unclaimed = members.filter((profile) => !profile.userId).length;
  return { members, leadCount, pendingRequests, rotations, unclaimed, target: coverageTargetForDepartment(department) };
}

function renderDepartmentCard(department, dates) {
  const stats = departmentStats(department, dates);
  return `
    <article class="department-card">
      <button class="department-card-main" data-open-drawer="department-detail" data-department-id="${department.id}">
        <div class="department-card-head">
          <span class="eyebrow">Department</span>
          <strong>${department.name}</strong>
        </div>
        <div class="department-card-stats">
          <span><strong>${stats.members.length}</strong> members</span>
          <span><strong>${stats.target}</strong> target</span>
          <span><strong>${stats.leadCount}/${dates.length}</strong> leads</span>
          <span><strong>${stats.pendingRequests}</strong> pending</span>
        </div>
        <p>${stats.unclaimed} unclaimed profiles - ${stats.rotations} rotation versions</p>
      </button>
      <div class="department-card-actions">
        ${canManageProfiles() ? `<button type="button" class="ghost" data-create-member="${department.id}">${icons.plus} Member</button>` : ""}
      </div>
    </article>
  `;
}

function renderRotations() {
  const department = byId(state.departments, ui.selectedDepartmentId);
  const profiles = departmentProfiles();
  const canEditDepartmentRotations = canManageDepartment(ui.selectedDepartmentId);
  const stats = rotationStats(profiles);
  return `
    ${renderTopbar("Rotations", "Weekly rotation templates by department. Each column maps to a real weekday.", `
      <div class="top-actions">
        <select id="department-select">
          ${state.departments.map((item) => `<option value="${item.id}" ${item.id === ui.selectedDepartmentId ? "selected" : ""}>${item.name}</option>`).join("")}
        </select>
        ${canEditDepartmentRotations ? `
          <button class="ghost" data-open-drawer="rotation">${icons.plus} New Rotation</button>
          <button class="${ui.rotationDepartmentEdit ? "ghost" : "primary"}" id="toggle-department-rotation-edit">
            ${ui.rotationDepartmentEdit ? `${icons.close} Cancel Edit` : `${icons.plus} Edit Department`}
          </button>
        ` : ""}
      </div>
    `)}
    <section class="rotation-overview">
      <div class="rotation-overview-copy">
        <span class="eyebrow">${department?.name || "Department"} Rotation Health</span>
        <strong>${stats.ready}/${stats.total} people ready</strong>
        <p>${stats.missing ? `${stats.missing} ${stats.missing === 1 ? "person still needs" : "people still need"} a weekly pattern.` : "Every department member has a weekly pattern."}</p>
      </div>
      <div class="rotation-overview-stats">
        <span><strong>${stats.workingSlots}</strong> work slots</span>
        <span><strong>${stats.offSlots}</strong> off slots</span>
        <span><strong>${stats.morningSlots}</strong> morning</span>
        <span><strong>${stats.nightSlots}</strong> night</span>
        <span><strong>${stats.nextEffective || "None"}</strong> next start</span>
      </div>
    </section>
    ${renderLeadRotationPanel(department)}
    ${ui.rotationDepartmentEdit ? renderDepartmentRotationToolbar(profiles) : ""}
    <section class="rotation-board">
      <div class="rotation-grid">
        <div class="rotation-head">
          <span>People</span>
          <strong>${department?.name || "Department"}</strong>
        </div>
        ${weekDays.map((day) => `<div class="rotation-day-head">${day}</div>`).join("")}
        ${profiles.map(renderRotationRow).join("")}
      </div>
    </section>
  `;
}

function rotationStats(profiles) {
  const rotations = profiles.map((profile) => latestRotationForProfile(profile.id)).filter(Boolean);
  const totals = rotations.flatMap((rotation) => sanitizeRotationPattern(rotation.pattern)).reduce((acc, statusId) => {
    const status = byId(state.statuses, statusId);
    if (status?.kind === "working") acc.workingSlots += 1;
    else acc.offSlots += 1;
    if (statusId === "morning") acc.morningSlots += 1;
    if (statusId === "night") acc.nightSlots += 1;
    return acc;
  }, { workingSlots: 0, offSlots: 0, morningSlots: 0, nightSlots: 0 });
  const futureStarts = rotations
    .map((rotation) => rotation.effectiveStart)
    .filter((date) => date >= todayIso)
    .sort();
  return {
    total: profiles.length,
    ready: rotations.length,
    missing: Math.max(profiles.length - rotations.length, 0),
    nextEffective: futureStarts[0],
    ...totals
  };
}

function renderRotationRow(profile) {
  const rotation = latestRotationForProfile(profile.id);
  const pattern = rotation ? sanitizeRotationPattern(rotation.pattern) : Array.from({ length: 7 });
  const missingClass = rotation ? "" : " missing";
  const isSelected = ui.selectedRotationProfileIds.includes(profile.id);
  const personContent = `
    <div class="avatar">${avatar(profile)}</div>
    <div class="rotation-person-meta">
      <strong>${profile.name}</strong>
      <span>${rotation ? `Effective ${rotation.effectiveStart}` : "Missing weekly pattern"}</span>
    </div>
    ${rotation ? "" : `<mark>Setup</mark>`}
  `;
  return `
    ${ui.rotationDepartmentEdit ? `
      <label class="employee-cell rotation-person rotation-person-selectable${missingClass}${isSelected ? " selected" : ""}">
        <input type="checkbox" data-rotation-profile-select="${profile.id}" ${isSelected ? "checked" : ""}>
        ${personContent}
      </label>
    ` : `
      <button class="employee-cell rotation-person${missingClass}" data-open-drawer="rotation-detail" data-profile-id="${profile.id}" data-rotation-id="${rotation?.id || ""}">
        ${personContent}
      </button>
    `}
    ${pattern.map((statusId) => renderRotationCell(profile, rotation, statusId)).join("")}
  `;
}

function renderHierarchy() {
  const levels = [
    ["manager", "Managers"],
    ["lead", "Department Leads"],
    ["senior", "Senior"],
    ["mid", "Mid-level"],
    ["junior", "Junior"]
  ];
  const visibleDepartments = selectedHierarchyDepartments();
  const unassignedProfiles = state.profiles.filter((profile) => !profileDepartmentIds(profile).length);
  const departmentSections = [
    ...visibleDepartments.map((department) => {
      const profiles = hierarchyProfilesForDepartment(department.id);
      return {
        id: department.id,
        name: department.name,
        meta: `${profiles.length} ${profiles.length === 1 ? "person" : "people"}`,
        profiles
      };
    }),
    ...(unassignedProfiles.length && visibleDepartments.length === state.departments.length ? [{
      id: "unassigned",
      name: "Unassigned",
      meta: `${unassignedProfiles.length} ${unassignedProfiles.length === 1 ? "person" : "people"}`,
      profiles: unassignedProfiles
    }] : [])
  ];
  const action = `
    <div class="top-actions compact-actions hierarchy-filters">
      <button class="segment" data-hierarchy-select="all">All</button>
      <button class="segment" data-hierarchy-select="none">Clear</button>
      ${state.departments.map((department) => `
        <button class="segment ${ui.hierarchyDepartmentIds.includes(department.id) ? "active" : ""}" data-hierarchy-department-filter="${department.id}">
          ${department.name}
        </button>
      `).join("")}
    </div>
  `;
  return `
    ${renderTopbar("Hierarchy", "Pick one or more departments and view people by seniority inside each.", action)}
    <section class="hierarchy-board">
      ${departmentSections.length ? departmentSections.map((section) => renderHierarchyDepartment(section, levels)).join("") : `<div class="empty-state"><strong>No departments selected</strong><span>Choose one or more departments above.</span></div>`}
    </section>
  `;
}

function renderHierarchyDepartment(section, levels) {
  return `
    <section class="hierarchy-department" data-hierarchy-department="${section.id}">
      <div class="hierarchy-department-head">
        <span class="eyebrow">Department</span>
        <strong>${section.name}</strong>
        <small>${section.meta}</small>
      </div>
      <div class="hierarchy-levels">
        ${levels.map(([level, label], index) => {
          const profiles = section.profiles.filter((profile) => (profile.seniorityLevel || "mid") === level);
          return `
            <section class="hierarchy-level level-${level}">
              <div class="hierarchy-level-head">
                <span>${String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>${label}</strong>
                  <small>${profiles.length} ${profiles.length === 1 ? "person" : "people"}</small>
                </div>
              </div>
              <div class="hierarchy-people">
                ${profiles.length ? profiles.map((profile) => renderHierarchyPerson(profile, section.id)).join("") : `<span class="hierarchy-empty">No people assigned</span>`}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderHierarchyPerson(profile, activeDepartmentId) {
  const departments = profileDepartmentIds(profile).map((id) => byId(state.departments, id)?.name).filter(Boolean);
  const activeDepartmentName = byId(state.departments, activeDepartmentId)?.name;
  const otherDepartments = activeDepartmentName ? departments.filter((department) => department !== activeDepartmentName) : departments;
  return `
    <button class="hierarchy-person" data-open-drawer="person" data-profile-id="${profile.id}">
      <div class="avatar">${avatar(profile)}</div>
      <div>
        <strong>${profile.name}</strong>
        <span>${profile.title}</span>
      </div>
      <div class="hierarchy-departments">
        ${activeDepartmentName ? `<em>${activeDepartmentName}</em>` : ""}
        ${otherDepartments.length ? otherDepartments.map((department) => `<em>${department}</em>`).join("") : activeDepartmentName ? "" : `<em>Unassigned</em>`}
      </div>
    </button>
  `;
}

function renderLeadRotationPanel(department) {
  if (!department) return "";
  const candidates = leadCandidates(department.id);
  const rotation = latestLeadRotation(department.id);
  const fallbackId = candidates[0]?.id || "";
  const pattern = Array.from({ length: 7 }, (_, index) => rotation?.pattern?.[index] || fallbackId);
  const canEdit = canManageDepartment(department.id);
  return `
    <form class="lead-rotation-panel" id="lead-rotation-form">
      <div class="lead-rotation-head">
        <div>
          <span class="eyebrow">Department Lead Rotation</span>
          <strong>${rotation ? `Effective ${formatDay(rotation.effectiveStart)} ${formatDate(rotation.effectiveStart)}` : "No weekly lead rotation"}</strong>
          <p>Choose the default lead for each weekday. Scheduler day assignments override this pattern.</p>
        </div>
        <label>Effective start<input type="date" name="effectiveStart" value="${rotation?.effectiveStart || todayIso}" ${canEdit ? "" : "disabled"} required></label>
      </div>
      ${candidates.length ? `
        <div class="lead-rotation-days">
          ${weekDays.map((day, index) => `
            <label>
              <span>${day}</span>
              <select name="lead-${index}" ${canEdit ? "" : "disabled"}>
                ${candidates.map((profile) => `<option value="${profile.id}" ${pattern[index] === profile.id ? "selected" : ""}>${profile.name}</option>`).join("")}
              </select>
            </label>
          `).join("")}
        </div>
        <button class="primary" ${canEdit ? "" : "disabled"}>Save Lead Rotation</button>
      ` : `
        <div class="empty-state compact">
          <strong>No department members</strong>
          <span>Add people to this department before setting a lead rotation.</span>
        </div>
      `}
    </form>
  `;
}

function renderRotationCell(profile, rotation, statusId) {
  if (!rotation) {
    return `
      <button class="rotation-cell shift-cell state-off missing" data-open-drawer="rotation-detail" data-profile-id="${profile.id}" data-rotation-id="">
        <span class="shift-icon">${icons.scheduler}</span>
        <span class="shift-label">No template</span>
        <small><span class="availability-badge">Missing</span>Template</small>
      </button>
    `;
  }
  const status = byId(state.statuses, statusId) || byId(state.statuses, "weekend");
  const availabilityState = status.id === "ground" ? "state-away" : status.kind === "working" ? "state-working" : "state-off";
  const availabilityLabel = availabilityState === "state-working" ? "Available" : "Unavailable";
  return `
    <button class="rotation-cell shift-cell ${availabilityState} ${status?.id || ""}" data-open-drawer="rotation-detail" data-profile-id="${profile.id}" data-rotation-id="${rotation?.id || ""}">
      <span class="shift-icon">${statusIcons[status?.id] || icons.scheduler}</span>
      <span class="shift-label">${status?.label || "Unassigned"}</span>
      <small><span class="availability-badge">${availabilityLabel}</span>Template</small>
    </button>
  `;
}

function latestRotationForProfile(profileId) {
  return state.rotationVersions
    .filter((rotation) => rotation.profileId === profileId)
    .sort((a, b) => b.effectiveStart.localeCompare(a.effectiveStart))[0];
}

function renderSettings() {
  return `
    ${renderTopbar("Settings", "Status labels are configurable. Red stays reserved for actions, alerts, and selected states.", canManageSystemSettings() ? `<button class="primary" data-open-drawer="status">${icons.plus} New Status</button>` : "")}
    <section class="status-grid">
      ${state.statuses.map((status) => `
        <button class="status-card" data-open-drawer="status-detail" data-status-id="${status.id}">
          <span class="shift-icon">${statusIcons[status.id] || icons.scheduler}</span>
          <strong>${status.label}</strong>
          <em>${status.kind}</em>
        </button>
      `).join("")}
    </section>
  `;
}

function renderActivity() {
  const entries = filteredActivityEntries();
  const allEntries = [...state.auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = activityCounts(allEntries);
  return `
    ${renderTopbar("Activity", "Recent schedule, profile, vacation, department, rotation, and settings changes.", `
      <div class="top-actions">
        <input id="activity-search" class="activity-search" placeholder="Search activity" value="${ui.activitySearch}">
      </div>
    `)}
    <section class="activity-summary">
      <span><strong>${allEntries.length}</strong> total</span>
      <span><strong>${counts.schedule}</strong> schedule</span>
      <span><strong>${counts.vacation}</strong> vacation</span>
      <span><strong>${counts.profile}</strong> profile</span>
      <span><strong>${counts.rotation}</strong> rotation</span>
    </section>
    <section class="control-row activity-filters">
      ${activityFilterButton("all", "All", allEntries.length)}
      ${activityFilterButton("schedule", "Schedule", counts.schedule)}
      ${activityFilterButton("vacation", "Vacation", counts.vacation)}
      ${activityFilterButton("profile", "Profile", counts.profile)}
      ${activityFilterButton("department", "Department", counts.department)}
      ${activityFilterButton("rotation", "Rotation", counts.rotation)}
      ${activityFilterButton("system", "System", counts.system)}
    </section>
    <section class="activity-list">
      ${entries.length ? entries.map(renderActivityItem).join("") : `<div class="empty-state"><strong>No activity yet</strong><span>Changes will appear here as admins and leads work.</span></div>`}
    </section>
  `;
}

function renderActivityItem(entry) {
  const target = activityTarget(entry);
  const type = activityType(entry);
  const actionClass = activityActionClass(entry);
  const tag = target ? "button" : "article";
  const attrs = target ? `type="button" data-activity-target="${target.type}" data-activity-id="${target.id}"` : "";
  return `
    <${tag} class="activity-item ${target ? "clickable" : ""} type-${type} action-${actionClass}" ${attrs}>
      <div class="activity-type-mark">
        <span class="activity-dot"></span>
      </div>
      <div class="activity-copy">
        <div class="activity-line">
          <strong>${activityVerb(entry)}</strong>
          <em>${activityTypeLabel(entry)}</em>
        </div>
        <span>${activityDetail(entry)}</span>
      </div>
      <time>${formatDateTime(entry.createdAt)}</time>
    </${tag}>
  `;
}

function filteredActivityEntries() {
  const query = ui.activitySearch.trim().toLowerCase();
  return [...state.auditLog]
    .filter((entry) => ui.activityType === "all" || activityType(entry) === ui.activityType)
    .filter((entry) => {
      if (!query) return true;
      return [entry.action, entry.entityType, entry.detail, activityDetail(entry), activityTypeLabel(entry)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function activityCounts(entries) {
  return entries.reduce((counts, entry) => {
    const type = activityType(entry);
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, { schedule: 0, vacation: 0, profile: 0, department: 0, rotation: 0, system: 0 });
}

function activityFilterButton(id, label, count) {
  return `<button class="segment ${ui.activityType === id ? "active" : ""}" data-activity-filter="${id}">${label}<span>${count}</span></button>`;
}

function activityType(entry) {
  if (entry.action?.startsWith("schedule.") || entry.entityType === "schedule_override" || entry.entityType === "department_lead") return "schedule";
  if (entry.action?.startsWith("vacation.") || entry.entityType === "vacation_request") return "vacation";
  if (entry.action?.startsWith("profile.") || entry.action?.startsWith("role.") || entry.entityType === "profile" || entry.entityType === "user_role") return "profile";
  if (entry.action?.startsWith("department.") || entry.entityType === "department") return "department";
  if (entry.action?.startsWith("rotation.") || entry.entityType === "rotation_version") return "rotation";
  return "system";
}

function activityTypeLabel(entry) {
  const type = activityType(entry);
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function activityVerb(entry) {
  const [scope, action = "updated"] = entry.action.split(".");
  const normalized = action.replace(/_/g, " ");
  if (scope === "schedule" && action === "override") return "Schedule changed";
  if (scope === "schedule" && action === "override_cleared") return "Schedule cleared";
  if (scope === "vacation" && action === "requested") return "Vacation requested";
  if (scope === "vacation" && action === "approved") return "Vacation approved";
  if (scope === "vacation" && action === "rejected") return "Vacation rejected";
  if (scope === "profile" && action === "department_assigned") return "Member assigned";
  if (scope === "profile" && action === "department_removed") return "Member unassigned";
  if (scope === "profile" && action === "updated") return "Profile updated";
  if (scope === "profile" && action === "created") return "Profile created";
  if (scope === "rotation" && action === "saved") return "Rotation saved";
  if (scope === "department" && action === "lead_set") return "Day lead set";
  return `${scope.charAt(0).toUpperCase() + scope.slice(1)} ${normalized}`;
}

function activityActionClass(entry) {
  return entry.action.replace(/\./g, "-").replace(/_/g, "-");
}

function activityDetail(entry) {
  const target = activityTarget(entry);
  if (target?.label) return `${target.label} - ${entry.detail || entry.entityType}`;
  return entry.detail || entry.entityType;
}

function activityTarget(entry) {
  if (entry.entityType === "profile") {
    const profile = byId(state.profiles, entry.entityId);
    if (profile) return { type: "person", id: profile.id, label: profile.name };
  }
  if (entry.entityType === "department") {
    const department = byId(state.departments, entry.entityId);
    if (department) return { type: "department-detail", id: department.id, label: department.name };
  }
  if (entry.entityType === "vacation_request") {
    const request = byId(state.vacationRequests, entry.entityId);
    const profile = byId(state.profiles, request?.profileId);
    if (request) return { type: "request-detail", id: request.id, label: profile?.name };
  }
  if (entry.entityType === "rotation_version") {
    const rotation = byId(state.rotationVersions, entry.entityId);
    const profile = byId(state.profiles, rotation?.profileId);
    if (rotation) return { type: "rotation-detail", id: rotation.id, label: profile?.name };
  }
  return null;
}

function formatAction(action) {
  return action.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, " ")).join(" · ");
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function relatedAuditEntries(predicate, limit = 4) {
  return state.auditLog
    .filter(predicate)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

function renderMiniActivity(entries) {
  return `
    <div class="mini-activity">
      <span class="eyebrow">Recent Activity</span>
      ${entries.length ? entries.map((entry) => `
        <div class="mini-activity-item">
          <strong>${formatAction(entry.action)}</strong>
          <span>${entry.detail}</span>
          <time>${formatDateTime(entry.createdAt)}</time>
        </div>
      `).join("") : `<p class="hint">No recent activity for this item.</p>`}
    </div>
  `;
}

function renderDrawer() {
  if (!ui.drawer) return "";
  const isCreation = isCreationDrawer();
  const titleMap = {
    shift: "Shift Override",
    person: "Employee Profile",
    profile: ui.drawer.profileId ? "Edit Profile" : "New Profile",
    request: "New Vacation",
    "request-detail": "Vacation Request",
    lead: "Day Editor",
    "calendar-day": "Day Details",
    coverage: "Coverage",
    department: "New Department",
    "department-detail": "Department",
    "department-member": "Add Member",
    rotation: "New Rotation",
    "rotation-detail": "Rotation Version",
    status: "New Status",
    "status-detail": "Status Label"
  };

  return `
    <aside class="drawer open ${isCreation ? "creation-modal" : "edit-sidebar"}" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div class="drawer-head">
        <div>
          <span class="eyebrow">${isCreation ? "Create" : "Details"}</span>
          <h2 id="drawer-title">${titleMap[ui.drawer.type]}</h2>
        </div>
        <button class="icon-button" id="close-drawer">${icons.close}</button>
      </div>
      ${drawerBody()}
    </aside>
  `;
}

function isCreationDrawer() {
  if (!ui.drawer) return false;
  if (ui.drawer.type === "profile") return !ui.drawer.profileId;
  return ["request", "department", "department-member", "rotation", "status"].includes(ui.drawer.type);
}

function drawerBody() {
  if (ui.drawer.type === "shift") return shiftDrawer();
  if (ui.drawer.type === "person") return personDrawer();
  if (ui.drawer.type === "profile") return profileDrawer();
  if (ui.drawer.type === "request") return requestDrawer();
  if (ui.drawer.type === "request-detail") return requestDetailDrawer();
  if (ui.drawer.type === "calendar-day") return calendarDayDrawer();
  if (ui.drawer.type === "lead") return leadDrawer();
  if (ui.drawer.type === "coverage") return coverageDrawer();
  if (ui.drawer.type === "department" || ui.drawer.type === "department-detail") return departmentDrawer();
  if (ui.drawer.type === "department-member") return departmentMemberDrawer();
  if (ui.drawer.type === "rotation" || ui.drawer.type === "rotation-detail") return rotationDrawer();
  if (ui.drawer.type === "status" || ui.drawer.type === "status-detail") return statusDrawer();
  return "";
}

function coverageDrawer() {
  const department = byId(state.departments, ui.selectedDepartmentId);
  const profiles = state.profiles.filter((profile) => profileBelongsToDepartment(profile, ui.selectedDepartmentId));
  const groups = coverageGroupsForDate(profiles, ui.drawer.date);
  const target = coverageTargetForDepartment(department);
  return `
    <div class="drawer-stack">
      <p class="hint">${formatDay(ui.drawer.date)}, ${formatDate(ui.drawer.date)} coverage for ${department.name}.</p>
      <div class="coverage-summary-card ${groups.available.length < target ? "low" : ""}">
        <span>Available</span>
        <strong>${groups.available.length} / ${target}</strong>
        <em>${groups.available.length < target ? "Below target" : "Target covered"}</em>
      </div>
      ${coverageGroup("Available", groups.available)}
      ${coverageGroup("On Ground", groups.away)}
      ${coverageGroup("Unavailable", groups.unavailable)}
    </div>
  `;
}

function coverageGroup(label, entries) {
  return `
    <div class="coverage-group">
      <div class="detail-line"><span>${label}</span><strong>${entries.length}</strong></div>
      ${entries.length ? entries.map(({ profile, schedule }) => `
        <button class="coverage-person" data-open-drawer="shift" data-profile-id="${profile.id}" data-date="${ui.drawer.date}">
          <div class="avatar">${avatar(profile)}</div>
          <div>
            <strong>${profile.name}</strong>
            <span>${schedule.label}</span>
          </div>
        </button>
      `).join("") : `<p class="hint">No people in this group.</p>`}
    </div>
  `;
}

function shiftDrawer() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  const schedule = scheduleFor(profile.id, ui.drawer.date);
  const canEdit = canManageDepartment(profile.departmentId) && editableDate(ui.drawer.date);
  const rotation = activeRotation(profile.id, ui.drawer.date);
  const rotationStatus = schedule.rotationStatus;
  const existingOverride = state.scheduleOverrides.find((entry) => entry.profileId === profile.id && entry.date === ui.drawer.date);
  const pendingVacation = vacationRequestForDate(profile.id, ui.drawer.date, "pending");
  const history = relatedAuditEntries((entry) => entry.detail.includes(ui.drawer.date) || entry.entityId === existingOverride?.id);
  return `
    <form id="shift-form" class="drawer-form">
      <div class="person-summary">
        <div class="avatar large">${avatar(profile)}</div>
        <div class="person-summary-copy">
          <strong>${profile.name}</strong>
          <span>${formatDay(ui.drawer.date)} ${formatDate(ui.drawer.date)}</span>
          <small>${schedule.source}</small>
        </div>
      </div>
      ${pendingVacation ? `
        <button type="button" class="request-context pending" data-open-drawer="request-detail" data-request-id="${pendingVacation.id}">
          <strong>Pending vacation request</strong>
          <span>${pendingVacation.startDate} to ${pendingVacation.endDate}</span>
        </button>
      ` : ""}
      <div class="detail-line"><span>Rotation default</span><strong>${rotationStatus?.label || "No rotation"}</strong></div>
      <div class="detail-line"><span>Override</span><strong>${existingOverride ? schedule.label : "None"}</strong></div>
      <div class="shift-status-picker">
        ${renderDailyStatusGroups("statusId", schedule.id, canEdit)}
      </div>
      <div class="form-grid two">
        <label>Apply from<input name="startDate" type="date" value="${ui.drawer.date}" ${canEdit ? "" : "disabled"}></label>
        <label>Apply to<input name="endDate" type="date" value="${ui.drawer.date}" ${canEdit ? "" : "disabled"}></label>
      </div>
      <label>Note<textarea name="note" ${canEdit ? "" : "disabled"}>${schedule.note || ""}</textarea></label>
      <p class="hint">${canEdit ? "Saving creates a manual daily change. Vacation, Sick, and On Ground live here, not in rotations." : "This date or department is locked for your role."}</p>
      <button class="primary wide" ${canEdit ? "" : "disabled"}>Save Daily Change</button>
      ${canManageDepartment(profile.departmentId) ? `<button type="button" class="ghost wide" data-open-drawer="rotation-detail" data-profile-id="${profile.id}" data-rotation-id="${rotation?.id || ""}">${rotation ? "Edit Weekly Rotation" : "Create Weekly Rotation"}</button>` : ""}
      <button type="button" class="danger wide" id="clear-override" ${canEdit && existingOverride ? "" : "disabled"}>Clear Override</button>
      ${renderMiniActivity(history)}
    </form>
  `;
}

function renderDailyStatusGroups(inputName, selectedStatusId, canEdit) {
  return dailyStatusGroups().map((group) => `
    <div class="status-choice-group">
      <span class="eyebrow">${group.label}</span>
      <div class="status-choice-grid">
        ${group.statuses.map((status) => `
          <label class="status-choice ${status.id}">
            <input type="radio" name="${inputName}" value="${status.id}" data-kind="${status.kind}" ${status.id === selectedStatusId ? "checked" : ""} ${canEdit ? "" : "disabled"}>
            <span>${statusIcons[status.id] || icons.scheduler}${status.label}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function personDrawer() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  const departmentSummary = profileDepartmentNames(profile).join(", ") || "Unassigned";
  const vacationRequests = vacationRequestsForProfile(profile.id).slice(0, 4);
  const history = relatedAuditEntries((entry) => entry.entityId === profile.id || entry.detail.includes(profile.email) || entry.detail.includes(profile.name));
  return `
    <div class="drawer-stack">
      <div class="person-summary">
        <div class="avatar large">${avatar(profile)}</div>
        <div><strong>${profile.name}</strong><span>${profile.employeeId} · ${profile.title}</span></div>
      </div>
      <div class="detail-line"><span>Departments</span><strong>${departmentSummary}</strong></div>
      <div class="detail-line"><span>Email</span><strong>${profile.email}</strong></div>
      <div class="detail-line"><span>Seniority</span><strong>${seniorityLevels.find(([id]) => id === profile.seniorityLevel)?.[1] || "Mid-level"}</strong></div>
      <div class="detail-line"><span>Role</span><strong>${profile.userId ? roleForProfile(profile) : "Unclaimed"}</strong></div>
      <div class="detail-line"><span>Vacation</span><strong>${profile.remainingVacationDays} / ${profile.yearlyVacationDays}</strong></div>
      <div class="detail-line"><span>Claiming</span><strong>${profile.userId ? "Account linked" : "Waiting for matching sign-in"}</strong></div>
      <div class="claim-panel ${profile.userId ? "claimed" : "unclaimed"}">
        <strong>${profile.userId ? "Claimed profile" : "Unclaimed profile"}</strong>
        <span>${profile.userId ? "This employee has linked a sign-in account." : "This profile can be claimed by signing in with its email."}</span>
      </div>
      <button class="primary wide" data-open-profile-page="${profile.id}">Open Full Profile</button>
      ${canEditProfile(profile) ? `<button class="primary wide" data-open-drawer="profile" data-profile-id="${profile.id}">${canManageProfiles() ? "Edit Profile" : "Edit My Profile"}</button>` : ""}
      ${canManageProfiles() && profile.departmentId ? `<button type="button" class="ghost wide" id="remove-department">Remove From Department</button>` : ""}
      ${canRequestVacationFor(profile) ? `<button class="ghost wide" data-open-drawer="request" data-profile-id="${profile.id}">Create Vacation Request</button>` : ""}
      ${canManageProfiles() && profile.userId ? `<button class="danger wide" id="unlink-profile">Unlink Account</button>` : ""}
      ${canManageProfiles() ? `<button type="button" class="danger wide" id="delete-profile">Delete Profile</button>` : ""}
      <div class="mini-activity">
        <span class="eyebrow">Vacation Requests</span>
        ${vacationRequests.length ? vacationRequests.map((request) => `
          <button class="vacation-mini ${request.status}" data-open-drawer="request-detail" data-request-id="${request.id}">
            <strong>${request.status}</strong>
            <span>${request.startDate} to ${request.endDate}</span>
          </button>
        `).join("") : `<p class="hint">No vacation requests for this employee yet.</p>`}
      </div>
      ${renderMiniActivity(history)}
    </div>
  `;
}

function profileDrawer() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  const canEdit = profile ? canEditProfile(profile) : canManageProfiles();
  const canEditAdminFields = canManageProfiles();
  const canEditPhoto = canEdit;
  return `
    <form id="profile-form" class="drawer-form">
      <div class="photo-uploader ${canEditPhoto ? "" : "disabled"}" id="photo-dropzone">
        <div class="avatar large" id="photo-preview">${avatar(profile)}</div>
        <div>
          <strong>${profile?.photo ? "Change photo" : "Upload photo"}</strong>
          <span>${canEditPhoto ? "Drop an image here or choose from your PC." : "Photo editing is locked for your role."}</span>
        </div>
        <input id="photo-input" type="file" accept="image/*" ${canEditPhoto ? "" : "disabled"}>
        <input name="photoRef" type="hidden" value="${profile?.photoRef || profile?.photo || ""}">
      </div>
      <label>Name<input name="name" required placeholder="Employee name" value="${profile?.name || ""}" ${canEdit ? "" : "disabled"}></label>
      <label>Email<input name="email" type="email" required placeholder="employee@sport360.test" value="${profile?.email || ""}" ${canEditAdminFields ? "" : "disabled"}></label>
      <label>Title<input name="title" required placeholder="Agent" value="${profile?.title || ""}" ${canEdit ? "" : "disabled"}></label>
      <label>Seniority<select name="seniorityLevel" ${canEditAdminFields ? "" : "disabled"}>
        ${seniorityLevels.map(([id, label]) => `<option value="${id}" ${(profile?.seniorityLevel || "mid") === id ? "selected" : ""}>${label}</option>`).join("")}
      </select></label>
      <label>Employee ID<input name="employeeId" required placeholder="SCH-100" value="${profile?.employeeId || ""}" ${canEditAdminFields ? "" : "disabled"}></label>
      <fieldset class="department-memberships" ${canEditAdminFields ? "" : "disabled"}>
        <legend>Departments</legend>
        ${state.departments.map((department) => {
          const isMember = profileDepartmentIds(profile).includes(department.id) || ui.drawer.departmentId === department.id;
          return `
            <label>
              <input type="checkbox" name="departmentMembership" value="${department.id}" ${isMember ? "checked" : ""}>
              <span>${department.name}</span>
            </label>
          `;
        }).join("")}
        <small>Each selected department is equal for schedules, rotations, and hierarchy.</small>
      </fieldset>
      <label>Yearly vacation days<input name="yearlyVacationDays" type="number" min="0" value="${profile?.yearlyVacationDays || 21}" ${canEditAdminFields ? "" : "disabled"}></label>
      <label>Remaining vacation days<input name="remainingVacationDays" type="number" min="0" value="${profile?.remainingVacationDays ?? profile?.yearlyVacationDays ?? 21}" ${canEditAdminFields ? "" : "disabled"}></label>
      ${canEditAdminFields && profile?.userId ? `
        <label>Application access role<select name="role">
          ${["employee", "lead", "admin"].map((role) => `<option value="${role}" ${roleForProfile(profile) === role ? "selected" : ""}>${role}</option>`).join("")}
        </select></label>
      ` : ""}
      <p class="hint">${canEditAdminFields ? "Application access controls permissions. Daily and weekly lead assignments are handled in Scheduler and Rotations." : "You can update your display name, title, and photo. Admins manage seniority, departments, access, email, and balances."}</p>
      <button class="primary wide" ${canEdit ? "" : "disabled"}>${profile ? "Save Profile" : "Create Profile"}</button>
    </form>
  `;
}

function departmentDrawer() {
  const department = byId(state.departments, ui.drawer.departmentId);
  const members = department ? state.profiles.filter((profile) => profileBelongsToDepartment(profile, department.id)) : [];
  const coverageTarget = department ? coverageTargetForDepartment(department) : 1;
  const canEdit = canManageDepartments();
  const dates = datesInRange();
  const assignedLeadDays = department ? dates.filter((date) => departmentLeadForDate(department.id, date).profile).length : 0;
  const stats = department ? departmentStats(department, dates) : null;
  return `
    <form id="department-form" class="drawer-form">
      <label>Department name<input name="name" required placeholder="Department name" value="${department?.name || ""}" ${canEdit ? "" : "disabled"}></label>
      <label>Minimum available people<input name="coverageTarget" type="number" min="0" value="${coverageTarget}" ${canEdit ? "" : "disabled"}></label>
      ${department ? `
        <div class="department-drawer-summary">
          <span><strong>${members.length}</strong> members</span>
          <span><strong>${coverageTarget}</strong> target</span>
          <span><strong>${assignedLeadDays}/${dates.length}</strong> lead days</span>
          <span><strong>${stats.pendingRequests}</strong> pending</span>
        </div>
        <div class="department-drawer-actions">
          <button type="button" class="ghost" data-go-department="${department.id}">Schedule</button>
          <button type="button" class="ghost" data-go-rotations="${department.id}">Rotations</button>
          ${canManageProfiles() ? `<button type="button" class="ghost" data-create-member="${department.id}">${icons.plus} Member</button>` : ""}
        </div>
        <div class="department-members">
          <span class="eyebrow">Members</span>
          ${members.length ? members.map((profile) => `
            <button type="button" class="department-member" data-open-drawer="person" data-profile-id="${profile.id}">
              <div class="avatar">${avatar(profile)}</div>
              <div>
                <strong>${profile.name}</strong>
                <span>${profile.title} · ${profile.userId ? roleForProfile(profile) : "Unclaimed"}</span>
              </div>
            </button>
          `).join("") : `<p class="hint">No members in this department yet.</p>`}
        </div>
      ` : ""}
      <button class="primary wide" ${canEdit ? "" : "disabled"}>${department ? "Save Department" : "Create Department"}</button>
      ${department && canEdit ? `<button type="button" class="danger wide" id="delete-department">Delete Department</button>` : ""}
    </form>
  `;
}

function unassignedProfiles() {
  const departmentIds = new Set(state.departments.map((department) => department.id));
  return state.profiles.filter((profile) => !profile.departmentId || !departmentIds.has(profile.departmentId));
}

function departmentMemberDrawer() {
  const department = byId(state.departments, ui.drawer.departmentId);
  const pool = unassignedProfiles();
  if (ui.drawer.memberMode === "existing") {
    return `
      <form id="department-member-form" class="drawer-form">
        <div class="member-flow-head">
          <span class="eyebrow">${department?.name || "Department"}</span>
          <strong>Add Existing Profiles</strong>
          <p class="hint">Select one or more unassigned profiles and add them to this department.</p>
        </div>
        <div class="member-choice-list">
          ${pool.length ? pool.map((profile) => `
            <label class="member-pick">
              <input type="checkbox" name="profileId" value="${profile.id}">
              <div class="avatar">${avatar(profile)}</div>
              <div>
                <strong>${profile.name}</strong>
                <span>${profile.title} · ${profile.email}</span>
              </div>
            </label>
          `).join("") : `<div class="empty-state compact"><strong>No unassigned profiles</strong><span>Create a new member instead, or clear a profile's department first.</span></div>`}
        </div>
        <button class="primary wide" ${pool.length ? "" : "disabled"}>Add Selected</button>
        <button type="button" class="ghost wide" data-member-mode="choice" data-department-id="${department?.id || ""}">Back</button>
      </form>
    `;
  }

  return `
    <div class="drawer-stack">
      <div class="member-flow-head">
        <span class="eyebrow">${department?.name || "Department"}</span>
        <strong>Add Department Member</strong>
        <p class="hint">Choose whether to assign existing unassigned profiles or create a brand new employee profile.</p>
      </div>
      <button type="button" class="member-choice-card" data-member-mode="existing" data-department-id="${department?.id || ""}">
        <strong>Assign existing profiles</strong>
        <span>${pool.length} unassigned profiles available. Multi-select is supported.</span>
      </button>
      <button type="button" class="member-choice-card" data-member-mode="new" data-department-id="${department?.id || ""}">
        <strong>Create new member</strong>
        <span>Open a new profile form already set to ${department?.name || "this department"}.</span>
      </button>
    </div>
  `;
}

function requestDrawer() {
  const fixedProfileId = ui.drawer.profileId;
  const startDate = ui.drawer.date || todayIso;
  const profiles = requestableProfiles();
  return `
    <form id="request-form" class="drawer-form">
      ${profiles.length ? `
        <label>Employee<select name="profileId">${profiles.map((profile) => `<option value="${profile.id}" ${fixedProfileId === profile.id ? "selected" : ""}>${profile.name}</option>`).join("")}</select></label>
      ` : `<p class="hint">No profiles are available for vacation requests with your role.</p>`}
      <label>Start date<input name="startDate" type="date" value="${startDate}" required></label>
      <label>End date<input name="endDate" type="date" value="${addDays(startDate, 1)}" required></label>
      <label>Reason<textarea name="reason" placeholder="Optional note"></textarea></label>
      <button class="primary wide" ${profiles.length ? "" : "disabled"}>Submit Request</button>
    </form>
  `;
}

function calendarDayDrawer() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  const department = byId(state.departments, profile.departmentId);
  const date = ui.drawer.date;
  const schedule = scheduleFor(profile.id, date);
  const rotationStatus = schedule.rotationStatus;
  const pendingVacation = vacationRequestForDate(profile.id, date, "pending");
  const approvedVacation = vacationRequestForDate(profile.id, date, "approved");
  const canRequest = canRequestVacationFor(profile);
  const canOpenScheduler = canManageDepartment(profile.departmentId);
  return `
    <div class="drawer-stack">
      <div class="person-summary">
        <div class="avatar large">${avatar(profile)}</div>
        <div class="person-summary-copy">
          <strong>${profile.name}</strong>
          <span>${profile.title}</span>
        </div>
      </div>
      <div class="calendar-day-summary ${schedule.kind}">
        <span class="shift-icon">${statusIcons[schedule.id] || icons.scheduler}</span>
        <div>
          <strong>${schedule.label}</strong>
          <span>${schedule.id === "ground" ? "Away" : schedule.kind === "working" ? "Available" : "Unavailable"} · ${schedule.source}</span>
        </div>
      </div>
      <div class="detail-line"><span>Date</span><strong>${formatDay(date)} ${formatDate(date)}</strong></div>
      <div class="detail-line"><span>Departments</span><strong>${profileDepartmentIds(profile).map((id) => byId(state.departments, id)?.name).filter(Boolean).join(", ") || "Unassigned"}</strong></div>
      <div class="detail-line"><span>Rotation default</span><strong>${rotationStatus?.label || "No rotation"}</strong></div>
      <div class="detail-line"><span>Manual override</span><strong>${schedule.override ? "Yes" : "No"}</strong></div>
      ${schedule.note ? `<p class="hint">${schedule.note}</p>` : ""}
      ${pendingVacation ? `
        <button type="button" class="request-context pending" data-open-drawer="request-detail" data-request-id="${pendingVacation.id}">
          <strong>Pending vacation request</strong>
          <span>${pendingVacation.startDate} to ${pendingVacation.endDate}</span>
        </button>
      ` : ""}
      ${approvedVacation ? `
        <button type="button" class="vacation-mini approved" data-open-drawer="request-detail" data-request-id="${approvedVacation.id}">
          <strong>Approved vacation</strong>
          <span>${approvedVacation.startDate} to ${approvedVacation.endDate}</span>
        </button>
      ` : ""}
      ${canOpenScheduler ? `<button type="button" class="ghost wide" data-open-scheduler-date="${date}" data-department-id="${profile.departmentId}">Open in Scheduler</button>` : ""}
      <button type="button" class="primary wide" data-open-drawer="request" data-profile-id="${profile.id}" data-date="${date}" ${canRequest ? "" : "disabled"}>Request Vacation From This Day</button>
    </div>
  `;
}

function vacationImpactForRequest(request, profile) {
  const department = byId(state.departments, profile.departmentId);
  const departmentProfilesList = state.profiles.filter((item) => item.departmentId === profile.departmentId);
  const dates = datesBetween(request.startDate, request.endDate);
  const rows = dates.map((date) => {
    const schedule = scheduleFor(profile.id, date);
    const coverage = coverageForDate(departmentProfilesList, date);
    const target = coverageTargetForDepartment(department);
    const changesToVacation = request.status === "pending"
      ? schedule.kind === "working"
      : schedule.id === "vacation";
    const availableAfter = request.status === "pending" && changesToVacation && schedule.id !== "ground"
      ? Math.max(0, coverage.available - 1)
      : coverage.available;
    return { date, schedule, coverage, target, changesToVacation, availableAfter };
  });
  const changedRows = rows.filter((row) => row.changesToVacation);
  const lowCoverageRows = rows.filter((row) => row.changesToVacation && row.target > 0 && row.availableAfter < row.target);
  const deductedDays = request.status === "pending" ? changedRows.length : request.deductedDays;
  return {
    rows,
    changedRows,
    lowCoverageRows,
    deductedDays,
    balanceAfter: request.status === "pending" ? profile.remainingVacationDays - deductedDays : profile.remainingVacationDays
  };
}

function requestDetailDrawer() {
  const request = byId(state.vacationRequests, ui.drawer.requestId);
  const profile = byId(state.profiles, request.profileId);
  const department = byId(state.departments, profile.departmentId);
  const impact = vacationImpactForRequest(request, profile);
  const approvable = request.status === "pending" && canManageDepartment(profile.departmentId);
  const enoughBalance = impact.balanceAfter >= 0;
  const hasCoverageRisk = impact.lowCoverageRows.length > 0;
  return `
    <div class="drawer-stack vacation-approval">
      <div class="person-summary approval-person">
        <div class="avatar large">${avatar(profile)}</div>
        <div>
          <strong>${profile.name}</strong>
          <span class="approval-title">${profile.title}</span>
          <span>${department?.name || "No department"}</span>
        </div>
      </div>
      <div class="approval-status ${request.status}">
        <div>
          <span>${request.status}</span>
          <strong>${request.startDate} to ${request.endDate}</strong>
        </div>
        <em>${impact.deductedDays} work days</em>
      </div>
      <div class="approval-balance ${enoughBalance ? "" : "low"}">
        <span><strong>${profile.remainingVacationDays}</strong> current balance</span>
        <span><strong>-${impact.deductedDays}</strong> scheduled work days</span>
        <span><strong>${impact.balanceAfter}</strong> after decision</span>
      </div>
      ${!enoughBalance ? `<p class="form-error">This request exceeds the employee's remaining vacation balance.</p>` : ""}
      ${hasCoverageRisk ? `<div class="approval-risk"><strong>${impact.lowCoverageRows.length} coverage risk${impact.lowCoverageRows.length === 1 ? "" : "s"}</strong><span>Approval drops available people below target on highlighted dates.</span></div>` : ""}
      <p class="hint">${request.reason || "No reason provided."}</p>
      <div class="impact-section">
        <div class="section-title">
          <span class="eyebrow">Schedule Impact</span>
          <strong>${impact.changedRows.length ? `${impact.changedRows.length} dates become Vacation` : "No working days affected"}</strong>
        </div>
        <div class="impact-list">
          ${impact.rows.map((row) => renderVacationImpactRow(row, request.status, profile.id)).join("")}
        </div>
      </div>
      <button class="primary wide" data-approve-request="${request.id}" ${approvable && enoughBalance ? "" : "disabled"}>Approve & Deduct</button>
      <button class="danger wide" data-reject-request="${request.id}" ${approvable ? "" : "disabled"}>Reject Request</button>
    </div>
  `;
}

function renderVacationImpactRow(row, requestStatus, profileId) {
  const isLowAfter = row.target > 0 && row.availableAfter < row.target;
  const afterText = requestStatus === "pending" && row.changesToVacation
    ? `${row.availableAfter}/${row.target || "-"} after`
    : `${row.coverage.available}/${row.target || "-"} available`;
  const impactText = row.changesToVacation
    ? requestStatus === "pending" ? `${row.schedule.label} to Vacation` : "Vacation recorded"
    : `${row.schedule.label} unchanged`;
  return `
    <button type="button" class="impact-row ${row.changesToVacation ? "changes" : ""} ${isLowAfter ? "low" : ""}" data-open-drawer="shift" data-profile-id="${profileId}" data-date="${row.date}">
      <span class="shift-icon">${statusIcons[row.schedule.id] || icons.scheduler}</span>
      <div>
        <strong>${formatDay(row.date)} ${formatDate(row.date)}</strong>
        <span>${impactText}</span>
      </div>
      <em><b>${afterText}</b>${isLowAfter ? "Below target" : "Coverage"}</em>
    </button>
  `;
}

function renderDepartmentRotationToolbar(profiles) {
  const selectedCount = ui.selectedRotationProfileIds.length;
  const allSelected = profiles.length > 0 && selectedCount === profiles.length;
  if (ui.rotationBulkEditing) return renderDepartmentRotationEditor();
  return `
    <section class="rotation-edit-toolbar">
      <div>
        <span class="eyebrow">Department edit</span>
        <strong>${selectedCount} ${selectedCount === 1 ? "person" : "people"} selected</strong>
        <p>Select the people whose weekly patterns should change together.</p>
      </div>
      <div class="rotation-edit-actions">
        <button type="button" class="ghost" id="toggle-all-rotation-people" ${profiles.length ? "" : "disabled"}>${allSelected ? "Clear selection" : "Select all"}</button>
        <button type="button" class="primary" id="continue-department-rotation-edit" ${selectedCount ? "" : "disabled"}>Continue with ${selectedCount || 0}</button>
      </div>
    </section>
  `;
}

function renderDepartmentRotationEditor() {
  const pattern = sanitizeRotationPattern(ui.rotationBulkPattern);
  const selectedProfiles = ui.selectedRotationProfileIds.map((id) => byId(state.profiles, id)).filter(Boolean);
  return `
    <form class="rotation-bulk-editor" id="department-rotation-form">
      <div class="rotation-bulk-head">
        <div>
          <span class="eyebrow">Shared weekly pattern</span>
          <strong>${selectedProfiles.length} ${selectedProfiles.length === 1 ? "person" : "people"}</strong>
          <p>${selectedProfiles.map((profile) => profile.name).join(", ")}</p>
        </div>
        <label>Effective start<input type="date" name="effectiveStart" value="${ui.rotationBulkEffectiveStart}" required></label>
      </div>
      ${rotationPresets.length ? `
        <div class="rotation-bulk-presets">
          <span>Apply preset</span>
          ${rotationPresets.map((preset) => `<button type="button" class="ghost" data-bulk-rotation-preset="${preset.id}">${preset.label}</button>`).join("")}
        </div>
      ` : ""}
      <div class="rotation-bulk-days">
        ${pattern.map((statusId, index) => bulkRotationDay(statusId, index)).join("")}
      </div>
      <div class="rotation-bulk-footer">
        <button type="button" class="ghost" id="back-to-rotation-selection">Back to selection</button>
        <button type="submit" class="primary">Save ${selectedProfiles.length} ${selectedProfiles.length === 1 ? "rotation" : "rotations"}</button>
      </div>
    </form>
  `;
}

function bulkRotationDay(statusId, index) {
  const status = byId(state.statuses, statusId) || byId(state.statuses, "weekend");
  return `
    <div class="rotation-bulk-day">
      <div><span>${weekDays[index]}</span><strong>${status.label}</strong></div>
      <div class="pattern-chip-row">
        ${rotationStatuses().map((item) => `
          <button type="button" class="pattern-chip ${item.id} ${item.id === status.id ? "active" : ""}" data-bulk-pattern-day="${index}" data-pattern-status="${item.id}" title="${item.label}">
            ${statusIcons[item.id] || icons.scheduler}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function leadDrawer() {
  const lead = state.departmentLeads.find((item) => item.departmentId === ui.selectedDepartmentId && item.date === ui.drawer.date);
  const resolvedLead = departmentLeadForDate(ui.selectedDepartmentId, ui.drawer.date);
  const profiles = state.profiles.filter((profile) => profileBelongsToDepartment(profile, ui.selectedDepartmentId));
  const candidates = leadCandidates(ui.selectedDepartmentId);
  const canEdit = canManageDepartment(ui.selectedDepartmentId) && editableDate(ui.drawer.date);
  const department = byId(state.departments, ui.selectedDepartmentId);
  const coverage = coverageForDate(profiles, ui.drawer.date);
  const target = department.coverageTarget || coverageTargets[department.id] || 0;
  const lowCoverage = target > 0 && coverage.available < target;
  const projected = coverageCountForStatusIds(profiles.map((profile) => scheduleFor(profile.id, ui.drawer.date).id));
  const unassigned = profiles.filter((profile) => scheduleFor(profile.id, ui.drawer.date).id === "empty").length;
  const manualCount = profiles.filter((profile) => scheduleFor(profile.id, ui.drawer.date).source === "Override").length;
  const exceptionCount = profiles.filter((profile) => exceptionStatusIds.includes(scheduleFor(profile.id, ui.drawer.date).id)).length;
  return `
    <div class="day-editor">
      <div class="day-editor-summary ${lowCoverage ? "low" : ""}">
        <div>
          <span class="eyebrow">${department.name}</span>
          <strong>${formatDay(ui.drawer.date)} ${formatDate(ui.drawer.date)}</strong>
          <small>${ui.drawer.date}</small>
        </div>
        <div class="day-editor-score">
          <strong>${coverage.available}</strong>
          <span>${target ? `of ${target} target` : "available"}</span>
        </div>
      </div>

      <div class="day-editor-metrics">
        <span><strong>${coverage.unavailable}</strong> unavailable</span>
        <span><strong>${coverage.away}</strong> on ground</span>
        <span><strong>${exceptionCount}</strong> exceptions</span>
        <span><strong>${manualCount}</strong> manual</span>
      </div>

      <div class="day-editor-projection" data-day-projection data-target="${target}">
        <div>
          <span class="eyebrow">Coverage Preview</span>
          <strong><b data-projected-available>${projected.available}</b>${target ? ` / ${target}` : ""} available after edits</strong>
        </div>
        <div class="day-editor-projection-metrics">
          <span><b data-projected-unavailable>${projected.unavailable}</b> unavailable</span>
          <span><b data-projected-away>${projected.away}</b> on ground</span>
          <span><b data-projected-changes>0</b> changed</span>
        </div>
      </div>

      <form id="lead-form" class="day-lead-form">
        <label>Daily lead override<select name="profileId" ${canEdit ? "" : "disabled"}>
          <option value="">Use weekly rotation${resolvedLead.rotation && resolvedLead.profile ? ` (${resolvedLead.profile.name})` : ""}</option>
          ${candidates.map((profile) => `<option value="${profile.id}" ${lead?.profileId === profile.id ? "selected" : ""}>${profile.name}</option>`).join("")}
        </select></label>
        <button class="ghost" ${canEdit ? "" : "disabled"}>Save</button>
      </form>

      <form id="day-bulk-form" class="drawer-form">
        <div class="section-title">
          <span class="eyebrow">Daily Exceptions</span>
          <strong>${profiles.length} people - ${manualCount} saved manual changes</strong>
        </div>
        <div class="bulk-shift-list">
          ${profiles.map((profile) => renderBulkShiftRow(profile, ui.drawer.date, canEdit)).join("")}
        </div>
        <p class="hint">${canEdit ? "Use rotation shifts for normal one-day swaps. Use Vacation, Sick, and On Ground for daily exceptions. Clear returns a row to its rotation." : "This day is locked for your role."}</p>
        <button class="primary wide" ${canEdit ? "" : "disabled"}>Save Daily Changes</button>
      </form>
    </div>
  `;
}

function renderBulkShiftRow(profile, date, canEdit) {
  const schedule = scheduleFor(profile.id, date);
  const existingOverride = state.scheduleOverrides.find((entry) => entry.profileId === profile.id && entry.date === date);
  const pendingVacation = vacationRequestForDate(profile.id, date, "pending");
  const availabilityLabel = schedule.id === "ground" ? "Away" : schedule.kind === "working" ? "Available" : "Unavailable";
  const sourceClass = schedule.source.toLowerCase().replace(/\s+/g, "-");
  const rotationStatusId = schedule.rotationStatus?.id || schedule.id;
  return `
    <div class="bulk-shift-row ${existingOverride ? "has-override" : ""}" data-bulk-row data-profile-id="${profile.id}" data-original-status="${schedule.id}" data-clear-status="${rotationStatusId}">
      <div class="bulk-shift-row-head">
        <div class="avatar">${avatar(profile)}</div>
        <div class="bulk-person">
          <strong>${profile.name}</strong>
          <span>${profile.title}</span>
        </div>
        <div class="bulk-current ${sourceClass}">
          <strong>${schedule.label}</strong>
          <span>${availabilityLabel} · ${schedule.source}</span>
        </div>
      </div>
      <input type="hidden" name="original-${profile.id}" value="${schedule.id}">
      <div class="bulk-status-options">
        ${renderDailyStatusGroups(`status-${profile.id}`, schedule.id, canEdit)}
      </div>
      ${pendingVacation ? `<button type="button" class="request-context pending compact" data-open-drawer="request-detail" data-request-id="${pendingVacation.id}"><strong>Pending vacation</strong><span>${pendingVacation.startDate} to ${pendingVacation.endDate}</span></button>` : ""}
      <div class="bulk-row-controls">
        <input name="note-${profile.id}" placeholder="Note" value="${existingOverride?.note || ""}" ${canEdit ? "" : "disabled"}>
        <label class="clear-toggle ${existingOverride ? "" : "disabled"}">
          <input type="checkbox" name="clear-${profile.id}" ${canEdit && existingOverride ? "" : "disabled"}>
          <span>Clear</span>
        </label>
      </div>
    </div>
  `;
}

function rotationDrawer() {
  const rotation = byId(state.rotationVersions, ui.drawer.rotationId) || latestRotationForProfile(ui.drawer.profileId);
  const departmentEditableProfiles = state.profiles.filter((profile) => canManageDepartment(profile.departmentId));
  const selectedProfileId = ui.drawer.profileId || rotation?.profileId || departmentEditableProfiles.find((profile) => profileBelongsToDepartment(profile, ui.selectedDepartmentId))?.id || departmentEditableProfiles[0]?.id;
  const selectedProfile = byId(state.profiles, selectedProfileId);
  const canEdit = canManageDepartment(selectedProfile?.departmentId || ui.selectedDepartmentId);
  const profiles = canEdit
    ? departmentEditableProfiles
    : [selectedProfile].filter(Boolean);
  const pattern = sanitizeRotationPattern(ui.drawer.patternDraft || rotation?.pattern);
  const patternStats = rotationPatternStats(pattern);
  return `
    <form id="rotation-form" class="drawer-form">
      <label>Employee<select name="profileId" ${canEdit ? "" : "disabled"}>${profiles.map((profile) => `<option value="${profile.id}" ${selectedProfileId === profile.id ? "selected" : ""}>${profile.name}</option>`).join("")}</select></label>
      <label>Effective start<input name="effectiveStart" type="date" value="${rotation?.effectiveStart || todayIso}" required ${canEdit ? "" : "disabled"}></label>
      <div class="pattern-editor">
        <div class="section-title">
          <span class="eyebrow">Repeating Pattern</span>
          <strong>${patternStats.working} working - ${patternStats.off} weekend/off</strong>
        </div>
        ${renderRotationPresetTool(pattern, canEdit)}
        <div class="pattern-slots">
          ${pattern.map((statusId, index) => patternSlot(statusId, index, canEdit)).join("")}
        </div>
      </div>
      <p class="hint">Rotations use Morning, Mid-day, Night, and Weekend only. Vacation, Sick, and On Ground are handled as daily changes.</p>
      <button class="primary wide" ${canEdit ? "" : "disabled"}>${rotation ? "Save Rotation" : "Create Rotation"}</button>
      ${rotation ? `<button class="ghost wide" name="saveMode" value="new-version" ${canEdit ? "" : "disabled"}>Save As New Version</button>` : ""}
    </form>
  `;
}

function renderRotationPresetTool(pattern, canEdit) {
  return `
    <div class="rotation-presets">
      <div class="rotation-preset-save">
        <input name="presetName" placeholder="Preset name" ${canEdit ? "" : "disabled"}>
        <button type="button" class="ghost" id="save-rotation-preset" ${canEdit ? "" : "disabled"}>Save Preset</button>
      </div>
      ${rotationPresets.length ? `
        <div class="rotation-preset-list">
          ${rotationPresets.map((preset) => `
            <div class="rotation-preset-item">
              <button type="button" class="ghost" data-rotation-preset="${preset.id}" ${canEdit ? "" : "disabled"}>
                <strong>${preset.label}</strong>
                <span>${rotationPatternLabel(preset.pattern)}</span>
              </button>
              <button type="button" class="icon-button" data-delete-rotation-preset="${preset.id}" ${canEdit ? "" : "disabled"}>${icons.close}</button>
            </div>
          `).join("")}
        </div>
      ` : `<p class="hint">Save your current weekday pattern as a preset when you want to reuse it.</p>`}
    </div>
  `;
}

function rotationPatternLabel(pattern) {
  return sanitizeRotationPattern(pattern).map((statusId) => byId(state.statuses, statusId)?.label || statusId).join(" / ");
}

function patternSlot(statusId, index, canEdit = true) {
  const status = byId(state.statuses, statusId) || byId(state.statuses, "weekend");
  return `
    <div class="pattern-slot">
      <div class="pattern-slot-head">
        <span>${weekDays[index]}</span>
        <strong>${status?.label || "Unassigned"}</strong>
      </div>
      <input type="hidden" name="patternItem" value="${status?.id || statusId || "weekend"}">
      <div class="pattern-chip-row">
        ${rotationStatuses().map((item) => `
          <button type="button" class="pattern-chip ${item.id} ${item.id === status?.id ? "active" : ""}" data-pattern-day="${index}" data-pattern-status="${item.id}" ${canEdit ? "" : "disabled"} title="${item.label}">
            ${statusIcons[item.id] || icons.scheduler}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function normalizeWeekPattern(pattern = defaultWeekPattern) {
  return normalizeWeekPatternLogic(pattern, defaultWeekPattern);
}

function rotationPatternStats(pattern) {
  return sanitizeRotationPattern(pattern).reduce((stats, statusId) => {
    const status = byId(state.statuses, statusId);
    if (status?.kind === "working") stats.working += 1;
    else stats.off += 1;
    return stats;
  }, { working: 0, off: 0 });
}

function statusDrawer() {
  const status = byId(state.statuses, ui.drawer.statusId);
  const canEdit = canManageSystemSettings();
  return `
    <form id="status-form" class="drawer-form">
      <label>Label<input name="label" value="${status?.label || ""}" required ${canEdit ? "" : "disabled"}></label>
      <label>Key<input name="id" value="${status?.id || ""}" ${status || !canEdit ? "readonly" : ""} required></label>
      <label>Type<select name="kind" ${canEdit ? "" : "disabled"}>
        ${["working", "off", "leave"].map((kind) => `<option value="${kind}" ${status?.kind === kind ? "selected" : ""}>${kind}</option>`).join("")}
      </select></label>
      <button class="primary wide" ${canEdit ? "" : "disabled"}>${status ? "Save Status" : "Create Status"}</button>
    </form>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.activeView = button.dataset.view;
      ui.drawer = null;
      render();
    });
  });

  document.querySelectorAll("[data-open-drawer]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.openDrawer === "profile") {
        ui.pendingPhotoFile = null;
        ui.pendingPhotoDataUrl = "";
      }
      ui.drawer = { type: button.dataset.openDrawer, ...button.dataset };
      render();
    });
  });

  document.querySelectorAll("[data-open-profile-page]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.profileViewId = button.dataset.openProfilePage;
      ui.activeView = "profile-page";
      ui.drawer = null;
      render();
    });
  });

  document.querySelector("#close-drawer")?.addEventListener("click", () => {
    ui.pendingPhotoFile = null;
    ui.pendingPhotoDataUrl = "";
    ui.drawer = null;
    render();
  });

  document.querySelector("#department-select")?.addEventListener("change", (event) => {
    ui.selectedDepartmentId = event.target.value;
    ui.rotationDepartmentEdit = false;
    ui.selectedRotationProfileIds = [];
    ui.rotationBulkEditing = false;
    render();
  });

  document.querySelector("#toggle-department-rotation-edit")?.addEventListener("click", () => {
    ui.rotationDepartmentEdit = !ui.rotationDepartmentEdit;
    ui.selectedRotationProfileIds = [];
    ui.rotationBulkEditing = false;
    render();
  });

  document.querySelectorAll("[data-rotation-profile-select]").forEach((input) => {
    input.addEventListener("change", () => {
      const profileId = input.dataset.rotationProfileSelect;
      ui.selectedRotationProfileIds = input.checked
        ? [...new Set([...ui.selectedRotationProfileIds, profileId])]
        : ui.selectedRotationProfileIds.filter((id) => id !== profileId);
      render();
    });
  });

  document.querySelector("#toggle-all-rotation-people")?.addEventListener("click", () => {
    const profileIds = departmentProfiles().map((profile) => profile.id);
    ui.selectedRotationProfileIds = ui.selectedRotationProfileIds.length === profileIds.length ? [] : profileIds;
    render();
  });

  document.querySelector("#continue-department-rotation-edit")?.addEventListener("click", () => {
    const firstRotation = latestRotationForProfile(ui.selectedRotationProfileIds[0]);
    ui.rotationBulkPattern = sanitizeRotationPattern(firstRotation?.pattern || defaultWeekPattern);
    ui.rotationBulkEffectiveStart = todayIso;
    ui.rotationBulkEditing = true;
    render();
  });

  document.querySelector("#back-to-rotation-selection")?.addEventListener("click", () => {
    ui.rotationBulkEditing = false;
    render();
  });

  document.querySelectorAll("[data-bulk-pattern-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const pattern = sanitizeRotationPattern(ui.rotationBulkPattern);
      pattern[Number(button.dataset.bulkPatternDay)] = button.dataset.patternStatus;
      ui.rotationBulkPattern = pattern;
      render();
    });
  });

  document.querySelectorAll("[data-bulk-rotation-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = rotationPresets.find((item) => item.id === button.dataset.bulkRotationPreset);
      if (!preset) return;
      ui.rotationBulkPattern = sanitizeRotationPattern(preset.pattern);
      render();
    });
  });

  document.querySelector("#department-rotation-form")?.addEventListener("submit", saveDepartmentRotations);

  document.querySelector("#people-department-select")?.addEventListener("change", (event) => {
    ui.peopleDepartmentId = event.target.value;
    render();
  });

  document.querySelectorAll("[data-people-view]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.peopleView = button.dataset.peopleView;
      render();
    });
  });

  document.querySelectorAll("[data-hierarchy-select]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.hierarchyDepartmentIds = button.dataset.hierarchySelect === "all" ? state.departments.map((department) => department.id) : [];
      render();
    });
  });

  document.querySelectorAll("[data-hierarchy-department-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const departmentId = button.dataset.hierarchyDepartmentFilter;
      const selected = new Set(ui.hierarchyDepartmentIds || []);
      if (selected.has(departmentId)) selected.delete(departmentId);
      else selected.add(departmentId);
      ui.hierarchyDepartmentIds = [...selected];
      render();
    });
  });

  document.querySelector("#range-select")?.addEventListener("change", (event) => {
    ui.rangeDays = Number(event.target.value);
    render();
  });

  document.querySelector("#zoom-in-range")?.addEventListener("click", () => {
    zoomScheduleRange(-1);
    render();
  });

  document.querySelector("#zoom-out-range")?.addEventListener("click", () => {
    zoomScheduleRange(1);
    render();
  });

  document.querySelector("#prev-range")?.addEventListener("click", () => {
    ui.startDate = addDays(ui.startDate, -ui.rangeDays);
    render();
  });

  document.querySelector("#month-prev-range")?.addEventListener("click", () => {
    ui.startDate = addDays(ui.startDate, -ui.rangeDays);
    render();
  });

  document.querySelector("#next-range")?.addEventListener("click", () => {
    ui.startDate = addDays(ui.startDate, ui.rangeDays);
    render();
  });

  document.querySelector("#month-next-range")?.addEventListener("click", () => {
    ui.startDate = addDays(ui.startDate, ui.rangeDays);
    render();
  });

  document.querySelector("#today-range")?.addEventListener("click", () => {
    ui.startDate = todayIso;
    render();
  });

  document.querySelectorAll("[data-calendar-prev]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.calendarMonth = addMonths(ui.calendarMonth, -1);
      render();
    });
  });

  document.querySelectorAll("[data-calendar-next]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.calendarMonth = addMonths(ui.calendarMonth, 1);
      render();
    });
  });

  document.querySelectorAll("[data-calendar-today]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.calendarMonth = todayIso.slice(0, 7);
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedFilter = button.dataset.filter;
      render();
    });
  });

  document.querySelectorAll("[data-request-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.requestFilter = button.dataset.requestFilter;
      render();
    });
  });

  document.querySelectorAll("[data-activity-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.activityType = button.dataset.activityFilter;
      render();
    });
  });

  document.querySelector("#activity-search")?.addEventListener("change", (event) => {
    ui.activitySearch = event.target.value;
    render();
  });

  document.querySelectorAll("[data-activity-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.activityTarget;
      const id = button.dataset.activityId;
      if (type === "person") ui.drawer = { type: "person", profileId: id };
      if (type === "department-detail") ui.drawer = { type: "department-detail", departmentId: id };
      if (type === "request-detail") ui.drawer = { type: "request-detail", requestId: id };
      if (type === "rotation-detail") ui.drawer = { type: "rotation-detail", rotationId: id };
      render();
    });
  });

  document.querySelector("#user-switcher")?.addEventListener("change", (event) => {
    state.currentUserId = event.target.value;
    saveState();
    render();
  });

  document.querySelector("#reset-demo")?.addEventListener("click", resetDemo);
  document.querySelector("#sign-out")?.addEventListener("click", signOut);
  document.querySelector("#dismiss-notice")?.addEventListener("click", () => {
    ui.notice = "";
    render();
  });
  document.querySelector("#shift-form")?.addEventListener("submit", saveShiftOverride);
  document.querySelector("#clear-override")?.addEventListener("click", clearShiftOverride);
  document.querySelector("#unlink-profile")?.addEventListener("click", unlinkProfileAccount);
  document.querySelector("#delete-profile")?.addEventListener("click", deleteProfile);
  document.querySelector("#remove-department")?.addEventListener("click", removeProfileDepartment);
  document.querySelector("#profile-form")?.addEventListener("submit", saveProfile);
  bindPhotoUploader();
  document.querySelector("#request-form")?.addEventListener("submit", saveVacationRequest);
  document.querySelector("#lead-form")?.addEventListener("submit", saveLead);
  document.querySelector("#day-bulk-form")?.addEventListener("submit", saveDayBulkOverrides);
  bindDayEditorPreview();
  document.querySelector("#department-form")?.addEventListener("submit", saveDepartment);
  document.querySelector("#delete-department")?.addEventListener("click", deleteDepartment);
  document.querySelector("#department-member-form")?.addEventListener("submit", assignDepartmentMembers);
  document.querySelector("#rotation-form")?.addEventListener("submit", saveRotation);
  document.querySelector("#lead-rotation-form")?.addEventListener("submit", saveLeadRotation);
  document.querySelector("#status-form")?.addEventListener("submit", saveStatus);

  document.querySelector("#save-rotation-preset")?.addEventListener("click", () => {
    const form = document.querySelector("#rotation-form");
    const name = form?.querySelector('input[name="presetName"]')?.value.trim();
    if (!name) {
      notify("Name the preset before saving it.");
      return;
    }
    const pattern = sanitizeRotationPattern(new FormData(form).getAll("patternItem").map((item) => item.trim()).filter(Boolean));
    const existing = rotationPresets.find((preset) => preset.label.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.pattern = pattern;
      existing.label = name;
    } else {
      rotationPresets.push({ id: makeId("rps"), label: name, pattern });
    }
    saveRotationPresets();
    ui.drawer.patternDraft = pattern;
    notify(`Saved rotation preset: ${name}`);
  });

  document.querySelectorAll("[data-rotation-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = rotationPresets.find((item) => item.id === button.dataset.rotationPreset);
      if (!preset) return;
      ui.drawer.patternDraft = sanitizeRotationPattern(preset.pattern);
      render();
    });
  });

  document.querySelectorAll("[data-delete-rotation-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      rotationPresets = rotationPresets.filter((preset) => preset.id !== button.dataset.deleteRotationPreset);
      saveRotationPresets();
      render();
    });
  });

  document.querySelectorAll("[data-pattern-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const pattern = sanitizeRotationPattern(ui.drawer.patternDraft || byId(state.rotationVersions, ui.drawer.rotationId)?.pattern || latestRotationForProfile(ui.drawer.profileId)?.pattern);
      pattern[Number(button.dataset.patternDay)] = button.dataset.patternStatus;
      ui.drawer.patternDraft = pattern;
      render();
    });
  });

  document.querySelectorAll("[data-approve-request]").forEach((button) => button.addEventListener("click", () => decideRequest(button.dataset.approveRequest, "approved")));
  document.querySelectorAll("[data-reject-request]").forEach((button) => button.addEventListener("click", () => decideRequest(button.dataset.rejectRequest, "rejected")));

  document.querySelectorAll("[data-select-department]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedDepartmentId = button.dataset.selectDepartment;
      ui.activeView = "scheduler";
      render();
    });
  });

  document.querySelectorAll("[data-go-department]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedDepartmentId = button.dataset.goDepartment;
      ui.activeView = "scheduler";
      ui.drawer = null;
      render();
    });
  });

  document.querySelectorAll("[data-go-rotations]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedDepartmentId = button.dataset.goRotations;
      ui.activeView = "rotations";
      ui.drawer = null;
      render();
    });
  });

  document.querySelectorAll("[data-open-scheduler-date]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedDepartmentId = button.dataset.departmentId;
      ui.startDate = button.dataset.openSchedulerDate;
      ui.activeView = "scheduler";
      ui.drawer = null;
      render();
    });
  });

  document.querySelectorAll("[data-create-member]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.drawer = { type: "department-member", departmentId: button.dataset.createMember };
      render();
    });
  });

  document.querySelectorAll("[data-member-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.memberMode === "new") {
        ui.drawer = { type: "profile", departmentId: button.dataset.departmentId };
      } else {
        ui.drawer = { type: "department-member", departmentId: button.dataset.departmentId, memberMode: button.dataset.memberMode === "choice" ? "" : button.dataset.memberMode };
      }
      render();
    });
  });

  applyMutationPendingUi();
}

function applyMutationPendingUi() {
  if (!isMutationPending()) return;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (control.id === "dismiss-notice") return;
    control.disabled = true;
  });
}

function bindPhotoUploader() {
  const dropzone = document.querySelector("#photo-dropzone");
  const input = document.querySelector("#photo-input");
  if (!dropzone || !input || input.disabled) return;

  dropzone.addEventListener("click", (event) => {
    if (event.target !== input) input.click();
  });
  input.addEventListener("change", () => handlePhotoFile(input.files?.[0]));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });
  dropzone.addEventListener("drop", (event) => handlePhotoFile(event.dataTransfer?.files?.[0]));
}

function handlePhotoFile(file) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!file || !allowedTypes.includes(file.type)) {
    notify("Choose a JPG, PNG, WebP, or GIF image.");
    return;
  }
  if (file.size > 750000) {
    notify("Please choose an image under 750 KB for now.");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const dataUrl = reader.result;
    const preview = document.querySelector("#photo-preview");
    ui.pendingPhotoFile = file;
    ui.pendingPhotoDataUrl = dataUrl;
    if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="">`;
  });
  reader.readAsDataURL(file);
}

function bindAuthEvents() {
  document.querySelector("#auth-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const form = new FormData(event.currentTarget);
    const intent = submitter?.value === "sign-up" ? "sign-up" : "sign-in";
    const email = form.get("email");
    const password = form.get("password");
    ui.error = "";
    ui.notice = "";
    const result = await runMutation("auth", {
      pending: intent === "sign-up" ? "Creating account..." : "Signing in...",
      success: intent === "sign-up" ? "Account is ready." : "Signed in.",
      failure: "Unable to authenticate."
    }, async () => {
      if (intent === "sign-up") {
        if (!appConfig.allowSignup) throw new Error("Account creation is disabled. Ask an Admin for an invitation.");
        const result = await dataStore.signUp(email, password);
        if (!result?.session) {
          ui.notice = "Account created. Check your email if confirmation is enabled, then sign in here.";
          ui.noticeKind = "success";
          render();
          return;
        }
      } else {
        await dataStore.signIn(email, password);
      }
      await reloadState();
    });
    if (!result.ok) {
      ui.error = result.error?.message || "Unable to authenticate.";
      render();
    }
  });
}

async function signOut() {
  await runMutation("sign-out", {
    pending: "Signing out...",
    success: "Signed out.",
    failure: "Unable to sign out."
  }, async () => {
    await dataStore.signOut();
    await reloadState();
  });
}

async function saveShiftOverride(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = byId(state.profiles, ui.drawer.profileId);
  if (!profile || !canManageDepartment(profile.departmentId) || !editableDate(ui.drawer.date)) return;
  const startDate = form.get("startDate") || ui.drawer.date;
  const endDate = form.get("endDate") || startDate;
  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const targetDates = datesBetween(rangeStart, rangeEnd).filter(editableDate);
  const payloads = targetDates.map((date) => {
    const existing = state.scheduleOverrides.find((entry) => entry.profileId === ui.drawer.profileId && entry.date === date);
    return {
      existing,
      payload: {
        id: existing?.id || makeId("ovr"),
        profileId: ui.drawer.profileId,
        date,
        statusId: form.get("statusId"),
        note: form.get("note").trim()
      }
    };
  });
  await runMutation("shift-override", {
    pending: "Saving daily change...",
    success: "Daily change saved.",
    failure: "The daily change could not be saved."
  }, async () => {
    for (const item of payloads) {
      if (item.existing) Object.assign(item.existing, item.payload);
      else state.scheduleOverrides.push(item.payload);
      audit("schedule.override", "schedule_override", item.payload.id, `${item.payload.date} set to ${item.payload.statusId}`);
      await dataStore.upsertScheduleOverride(item.payload);
    }
    await saveState();
    ui.drawer = null;
    render();
  });
}

async function clearShiftOverride() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  if (!profile || !canManageDepartment(profile.departmentId) || !editableDate(ui.drawer.date)) return;
  const existing = state.scheduleOverrides.find((entry) => entry.profileId === ui.drawer.profileId && entry.date === ui.drawer.date);
  if (!existing) return;
  await runMutation("shift-clear", {
    pending: "Clearing daily change...",
    success: "Daily change cleared.",
    failure: "The daily change could not be cleared."
  }, async () => {
    state.scheduleOverrides = state.scheduleOverrides.filter((entry) => entry.id !== existing.id);
    audit("schedule.override_cleared", "schedule_override", existing.id, `${existing.date} returned to rotation`);
    await dataStore.deleteScheduleOverride(existing);
    await saveState();
    ui.drawer = null;
    render();
  });
}

async function saveProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const existing = byId(state.profiles, ui.drawer.profileId);
  const hadProfileAdmin = canManageProfiles();
  if (!hadProfileAdmin && (!existing || currentProfile()?.id !== existing.id)) return;
  const departmentIds = hadProfileAdmin
    ? form.getAll("departmentMembership").filter((departmentId, index, values) => departmentId && values.indexOf(departmentId) === index)
    : profileDepartmentIds(existing);
  const departmentId = hadProfileAdmin ? (departmentIds[0] || null) : existing.departmentId;
  const profile = {
    id: existing?.id || makeId("emp"),
    employeeId: hadProfileAdmin ? form.get("employeeId") : existing.employeeId,
    email: hadProfileAdmin ? form.get("email") : existing.email,
    name: form.get("name"),
    title: form.get("title"),
    seniorityLevel: hadProfileAdmin ? form.get("seniorityLevel") : existing.seniorityLevel,
    leadEligible: existing?.leadEligible ?? true,
    departmentId,
    departmentIds,
    photo: existing?.photo || "",
    photoRef: existing?.photoRef || form.get("photoRef") || "",
    yearlyVacationDays: hadProfileAdmin ? Number(form.get("yearlyVacationDays")) : existing.yearlyVacationDays,
    remainingVacationDays: hadProfileAdmin ? Number(form.get("remainingVacationDays")) : existing.remainingVacationDays,
    userId: existing?.userId || null
  };
  const previousPhotoRef = existing?.photoRef || "";
  await runMutation("profile-save", {
    pending: ui.pendingPhotoFile ? "Uploading photo and saving profile..." : "Saving profile...",
    success: existing ? "Profile saved." : "Profile created.",
    failure: "The profile could not be saved."
  }, async () => {
    let uploadedPhoto = null;
    try {
      if (ui.pendingPhotoFile) {
        uploadedPhoto = await dataStore.uploadProfilePhoto(profile.id, ui.pendingPhotoFile, ui.pendingPhotoDataUrl);
        profile.photo = uploadedPhoto.url;
        profile.photoRef = uploadedPhoto.reference;
      }
      if (existing && !hadProfileAdmin) await dataStore.updateOwnProfile(profile);
      else if (existing) await dataStore.updateProfile(profile);
      else {
        await dataStore.createProfile(profile);
        if (hadProfileAdmin) await dataStore.setProfileDepartments(profile);
      }

      if (hadProfileAdmin && existing?.userId && form.get("role")) {
        const userRole = { userId: existing.userId, role: form.get("role") };
        await dataStore.upsertUserRole(userRole);
        const existingRole = state.userRoles?.find((role) => role.userId === userRole.userId);
        if (existingRole) Object.assign(existingRole, userRole);
        else {
          state.userRoles ||= [];
          state.userRoles.push(userRole);
        }
        if (existing.userId === currentUser()?.id) currentUser().role = userRole.role;
        audit("role.updated", "user_role", userRole.userId, `${profile.name} set to ${userRole.role}`);
      }
    } catch (error) {
      if (uploadedPhoto) await dataStore.deleteProfilePhoto(uploadedPhoto.reference).catch(() => {});
      throw error;
    }

    if (existing) Object.assign(existing, profile);
    else state.profiles.push(profile);
    if (uploadedPhoto && previousPhotoRef && previousPhotoRef !== uploadedPhoto.reference) {
      await dataStore.deleteProfilePhoto(previousPhotoRef).catch(() => {});
    }
    ui.pendingPhotoFile = null;
    ui.pendingPhotoDataUrl = "";
    audit(existing ? "profile.updated" : "profile.created", "profile", profile.id, profile.email);
    await saveState();
    ui.drawer = { type: "person", profileId: profile.id };
    render();
  });
}

async function unlinkProfileAccount() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  if (!profile?.userId || !canManageProfiles()) return;
  const previousUserId = profile.userId;
  await runMutation("profile-unlink", {
    pending: "Unlinking account...",
    success: "Account unlinked.",
    failure: "The account could not be unlinked."
  }, async () => {
    profile.userId = null;
    state.userRoles = (state.userRoles || []).filter((role) => role.userId !== previousUserId);
    audit("profile.unlinked", "profile", profile.id, `${profile.email} account link removed`);
    await dataStore.unlinkProfileAccount({ ...profile, userId: previousUserId });
    await saveState();
    ui.drawer = { type: "person", profileId: profile.id };
    render();
  });
}

async function deleteProfile() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  if (!profile || !canManageProfiles()) return;
  const confirmed = confirm(`Delete ${profile.name}'s profile? This removes their schedule history, requests, rotations, and profile link from this app.`);
  if (!confirmed) return;

  const deletedPhotoRef = profile.photoRef || "";
  await runMutation("profile-delete", {
    pending: "Deleting profile...",
    success: "Profile deleted.",
    failure: "The profile could not be deleted."
  }, async () => {
    state.profiles = state.profiles.filter((item) => item.id !== profile.id);
    state.rotationVersions = state.rotationVersions.filter((rotation) => rotation.profileId !== profile.id);
    state.scheduleOverrides = state.scheduleOverrides.filter((override) => override.profileId !== profile.id);
    state.vacationRequests = state.vacationRequests.filter((request) => request.profileId !== profile.id);
    state.departmentLeads = state.departmentLeads.filter((lead) => lead.profileId !== profile.id);
    state.departmentLeadRotations = (state.departmentLeadRotations || []).filter((rotation) => !rotation.pattern.includes(profile.id));
    state.userRoles = (state.userRoles || []).filter((role) => role.userId !== profile.userId);
    state.auditLog = (state.auditLog || []).filter((entry) => entry.entityId !== profile.id && !entry.detail?.includes(profile.email));

    audit("profile.deleted", "profile", profile.id, `${profile.name} deleted`);
    await dataStore.deleteProfile(profile);
    if (deletedPhotoRef) await dataStore.deleteProfilePhoto(deletedPhotoRef).catch(() => {});
    await saveState();
    if (ui.profileViewId === profile.id) ui.profileViewId = null;
    ui.drawer = null;
    render();
  });
}

async function removeProfileDepartment() {
  const profile = byId(state.profiles, ui.drawer.profileId);
  if (!profile?.departmentId || !canManageProfiles()) return;
  const previousDepartmentId = profile.departmentId;
  const previousDepartmentIds = [...profileDepartmentIds(profile)];
  const previousDepartment = byId(state.departments, profile.departmentId);
  const previousLeads = [...state.departmentLeads];
  const auditEntry = {
    id: makeId("aud"),
    actorId: currentUser()?.id,
    action: "profile.department_removed",
    entityType: "profile",
    entityId: profile.id,
    detail: `${profile.name} removed from ${previousDepartment?.name || "department"}`,
    createdAt: new Date().toISOString()
  };
  await runMutation("profile-remove-department", {
    pending: "Removing department...",
    success: "Department removed from profile.",
    failure: "Unable to remove department."
  }, async () => {
    profile.departmentId = null;
    profile.departmentIds = [];
    state.departmentLeads = state.departmentLeads.filter((lead) => lead.profileId !== profile.id);
    state.auditLog.unshift(auditEntry);
    ui.drawer = null;
    render();
    await dataStore.updateProfile(profile);
    if (dataStore?.mode === "supabase") void dataStore.insertAudit(auditEntry);
    await saveState();
  }).then((result) => {
    if (result.ok) return;
    profile.departmentId = previousDepartmentId;
    profile.departmentIds = previousDepartmentIds;
    state.departmentLeads = previousLeads;
    state.auditLog = state.auditLog.filter((entry) => entry.id !== auditEntry.id);
    render();
  });
}

async function saveDepartment(event) {
  event.preventDefault();
  if (!canManageDepartments()) return;
  const form = new FormData(event.currentTarget);
  const existing = byId(state.departments, ui.drawer.departmentId);
  const department = {
    id: existing?.id || makeId("dep"),
    name: form.get("name").trim(),
    coverageTarget: Number(form.get("coverageTarget") || 0)
  };
  await runMutation("department-save", {
    pending: "Saving department...",
    success: existing ? "Department saved." : "Department created.",
    failure: "The department could not be saved."
  }, async () => {
    if (existing) Object.assign(existing, department);
    else state.departments.push(department);
    coverageTargets[department.id] = department.coverageTarget;
    saveCoverageTargets();
    audit(existing ? "department.updated" : "department.created", "department", department.id, department.name);
    await dataStore.upsertDepartment(department);
    await saveState();
    ui.drawer = { type: "department-detail", departmentId: department.id };
    render();
  });
}

async function deleteDepartment() {
  const department = byId(state.departments, ui.drawer.departmentId);
  if (!department || !canManageDepartments()) return;
  const previousDepartments = [...state.departments];
  const previousProfiles = state.profiles.map((profile) => ({ ...profile }));
  const previousLeads = [...state.departmentLeads];
  const previousSelectedDepartmentId = ui.selectedDepartmentId;
  const affectedProfiles = state.profiles.filter((profile) => profileBelongsToDepartment(profile, department.id));
  const confirmed = window.confirm(`Delete ${department.name}? ${affectedProfiles.length} ${affectedProfiles.length === 1 ? "person" : "people"} will become unassigned.`);
  if (!confirmed) return;

  await runMutation("department-delete", {
    pending: `Deleting ${department.name}...`,
    success: `${department.name} deleted. ${affectedProfiles.length} ${affectedProfiles.length === 1 ? "person is" : "people are"} now unassigned.`,
    failure: "The department could not be deleted."
  }, async () => {
    for (const profile of affectedProfiles) {
      profile.departmentIds = profileDepartmentIds(profile).filter((departmentId) => departmentId !== department.id);
      if (profile.departmentId === department.id) profile.departmentId = profile.departmentIds[0] || null;
      await dataStore.updateProfile(profile);
    }
    state.departmentLeads = state.departmentLeads.filter((lead) => lead.departmentId !== department.id);
    state.departments = state.departments.filter((item) => item.id !== department.id);
    delete coverageTargets[department.id];
    saveCoverageTargets();
    if (ui.selectedDepartmentId === department.id) ui.selectedDepartmentId = state.departments[0]?.id || "";
    audit("department.deleted", "department", department.id, `${department.name} deleted`);
    await dataStore.deleteDepartment(department);
    await saveState();
    ui.drawer = null;
    ui.activeView = "departments";
    render();
  }).then((result) => {
    if (result.ok) return;
    state.departments = previousDepartments;
    state.profiles = previousProfiles;
    state.departmentLeads = previousLeads;
    ui.selectedDepartmentId = previousSelectedDepartmentId;
    render();
  });
}

async function assignDepartmentMembers(event) {
  event.preventDefault();
  if (!canManageProfiles()) return;
  const department = byId(state.departments, ui.drawer.departmentId);
  if (!department) return;
  const form = new FormData(event.currentTarget);
  const profileIds = form.getAll("profileId");
  if (!profileIds.length) return;
  await runMutation("department-members", {
    pending: "Adding selected members...",
    success: `${profileIds.length} ${profileIds.length === 1 ? "member" : "members"} added.`,
    failure: "Selected members could not be added."
  }, async () => {
    for (const profileId of profileIds) {
      const profile = byId(state.profiles, profileId);
      if (!profile) continue;
      profile.departmentId = department.id;
      profile.departmentIds = [department.id];
      audit("profile.department_assigned", "profile", profile.id, `${profile.name} added to ${department.name}`);
      await dataStore.updateProfile(profile);
    }
    await saveState();
    ui.drawer = { type: "department-detail", departmentId: department.id };
    render();
  });
}

async function saveVacationRequest(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = byId(state.profiles, form.get("profileId"));
  if (!canRequestVacationFor(profile)) return;
  const request = {
    id: makeId("vac"),
    profileId: form.get("profileId"),
    startDate: form.get("startDate"),
    endDate: form.get("endDate"),
    reason: form.get("reason"),
    status: "pending",
    requestedAt: new Date().toISOString(),
    decidedBy: null,
    decidedAt: null,
    deductedDays: 0
  };
  await runMutation("vacation-request", {
    pending: "Submitting vacation request...",
    success: "Vacation request submitted.",
    failure: "The vacation request could not be submitted."
  }, async () => {
    state.vacationRequests.unshift(request);
    audit("vacation.requested", "vacation_request", request.id, `${request.startDate} to ${request.endDate}`);
    await dataStore.createVacationRequest(request);
    await saveState();
    ui.activeView = "requests";
    ui.drawer = null;
    render();
  });
}

async function decideRequest(requestId, decision) {
  const request = byId(state.vacationRequests, requestId);
  const profile = byId(state.profiles, request.profileId);
  if (!request || !profile || request.status !== "pending" || !canManageDepartment(profile.departmentId)) return;
  const days = workdayCount(profile.id, request.startDate, request.endDate);
  await runMutation("vacation-decision", {
    pending: decision === "approved" ? "Approving request..." : "Rejecting request...",
    success: decision === "approved" ? "Request approved." : "Request rejected.",
    failure: "The request decision could not be saved."
  }, async () => {
    if (dataStore?.mode === "supabase") {
      await dataStore.updateVacationDecision({ ...request, status: decision }, profile, []);
      audit(`vacation.${decision}`, "vacation_request", request.id, `${days} work days`);
      ui.drawer = null;
      await reloadState();
      return;
    }

    const changedOverrides = [];
    request.status = decision;
    request.decidedBy = currentUser().id;
    request.decidedAt = new Date().toISOString();
    request.deductedDays = decision === "approved" ? days : 0;

    if (decision === "approved") {
      profile.remainingVacationDays -= days;
      for (let offset = 0; offset <= dateDiff(request.startDate, request.endDate); offset += 1) {
        const date = addDays(request.startDate, offset);
        if (scheduleFor(profile.id, date).kind !== "working") continue;
        const existing = state.scheduleOverrides.find((entry) => entry.profileId === profile.id && entry.date === date);
        const payload = { id: existing?.id || makeId("ovr"), profileId: profile.id, date, statusId: "vacation", note: `Vacation request ${request.id}` };
        if (existing) Object.assign(existing, payload);
        else state.scheduleOverrides.push(payload);
        changedOverrides.push(payload);
      }
    }

    audit(`vacation.${decision}`, "vacation_request", request.id, `${days} work days`);
    await dataStore.updateVacationDecision(request, profile, changedOverrides);
    await saveState();
    ui.drawer = null;
    render();
  });
}

async function saveLead(event) {
  event.preventDefault();
  if (!canManageDepartment(ui.selectedDepartmentId) || !editableDate(ui.drawer.date)) return;
  const form = new FormData(event.currentTarget);
  const existing = state.departmentLeads.find((item) => item.departmentId === ui.selectedDepartmentId && item.date === ui.drawer.date);
  const profileId = form.get("profileId");
  const payload = { id: existing?.id || makeId("lead"), departmentId: ui.selectedDepartmentId, date: ui.drawer.date, profileId };
  await runMutation("daily-lead", {
    pending: "Saving daily lead...",
    success: profileId ? "Daily lead override saved." : "Daily lead returned to weekly rotation.",
    failure: "The daily lead could not be saved."
  }, async () => {
    if (!profileId) {
      if (existing) {
        state.departmentLeads = state.departmentLeads.filter((item) => item.id !== existing.id);
        await dataStore.deleteDailyLead(existing);
        audit("department.lead_cleared", "department_lead", existing.id, `${existing.date} returned to weekly lead rotation`);
      }
    } else {
      if (existing) Object.assign(existing, payload);
      else state.departmentLeads.push(payload);
      audit("department.lead_set", "department_lead", payload.id, `${payload.date} lead`);
      await dataStore.upsertDailyLead(payload);
    }
    await saveState();
    ui.drawer = null;
    render();
  });
}

async function saveLeadRotation(event) {
  event.preventDefault();
  const departmentId = ui.selectedDepartmentId;
  if (!canManageDepartment(departmentId)) return;
  const form = new FormData(event.currentTarget);
  const effectiveStart = form.get("effectiveStart");
  if (!effectiveStart || (!editableDate(effectiveStart) && !isAdmin())) return;
  const pattern = weekDays.map((_, index) => form.get(`lead-${index}`));
  if (pattern.some((profileId) => !leadCandidates(departmentId).some((profile) => profile.id === profileId))) {
    notify("Every weekday needs an eligible lead from this department.", "error");
    return;
  }
  const existing = (state.departmentLeadRotations || []).find((rotation) => rotation.departmentId === departmentId && rotation.effectiveStart === effectiveStart);
  const payload = {
    id: existing?.id || makeId("lead-rotation"),
    departmentId,
    effectiveStart,
    pattern
  };
  await runMutation("lead-rotation", {
    pending: "Saving department lead rotation...",
    success: "Department lead rotation saved.",
    failure: "The department lead rotation could not be saved."
  }, async () => {
    await dataStore.upsertDepartmentLeadRotation(payload);
    state.departmentLeadRotations ||= [];
    if (existing) Object.assign(existing, payload);
    else state.departmentLeadRotations.push(payload);
    audit("department.lead_rotation_saved", "department_lead_rotation", payload.id, `${effectiveStart} weekly lead pattern`);
    await saveState();
    render();
  });
}

function bindDayEditorPreview() {
  const form = document.querySelector("#day-bulk-form");
  const preview = document.querySelector("[data-day-projection]");
  if (!form || !preview) return;
  const target = Number(preview.dataset.target || 0);
  const update = () => {
    const statusIds = [];
    let changed = 0;
    form.querySelectorAll("[data-bulk-row]").forEach((row) => {
      const clear = row.querySelector('input[name^="clear-"]')?.checked;
      const selectedStatusId = clear
        ? row.dataset.clearStatus
        : row.querySelector('input[type="radio"]:checked')?.value || row.dataset.originalStatus;
      const note = row.querySelector('input[name^="note-"]')?.value.trim();
      statusIds.push(selectedStatusId);
      if (selectedStatusId !== row.dataset.originalStatus || note) changed += 1;
    });
    const projected = coverageCountForStatusIds(statusIds);
    preview.classList.toggle("low", target > 0 && projected.available < target);
    preview.querySelector("[data-projected-available]").textContent = projected.available;
    preview.querySelector("[data-projected-unavailable]").textContent = projected.unavailable;
    preview.querySelector("[data-projected-away]").textContent = projected.away;
    preview.querySelector("[data-projected-changes]").textContent = changed;
  };
  form.addEventListener("change", update);
  form.addEventListener("input", update);
  update();
}

async function saveDayBulkOverrides(event) {
  event.preventDefault();
  const date = ui.drawer.date;
  if (!canManageDepartment(ui.selectedDepartmentId) || !editableDate(date)) return;
  const form = new FormData(event.currentTarget);
  const profiles = state.profiles.filter((profile) => profileBelongsToDepartment(profile, ui.selectedDepartmentId));
  const changed = [];
  const cleared = [];

  for (const profile of profiles) {
    const statusId = form.get(`status-${profile.id}`);
    const originalStatusId = form.get(`original-${profile.id}`);
    const note = (form.get(`note-${profile.id}`) || "").trim();
    const shouldClear = form.get(`clear-${profile.id}`) === "on";
    const existing = state.scheduleOverrides.find((entry) => entry.profileId === profile.id && entry.date === date);
    if (shouldClear) {
      if (!existing) continue;
      cleared.push(existing);
      continue;
    }
    if (!existing && statusId === originalStatusId && !note) continue;

    const payload = {
      id: existing?.id || makeId("ovr"),
      profileId: profile.id,
      date,
      statusId,
      note
    };
    changed.push({ existing, payload });
  }

  await runMutation("day-bulk", {
    pending: "Saving daily changes...",
    success: "Daily changes saved.",
    failure: "The daily changes could not be saved."
  }, async () => {
    for (const existing of cleared) {
      state.scheduleOverrides = state.scheduleOverrides.filter((entry) => entry.id !== existing.id);
      audit("schedule.override_cleared", "schedule_override", existing.id, `${existing.date} returned to rotation`);
      await dataStore.deleteScheduleOverride(existing);
    }

    for (const item of changed) {
      if (item.existing) Object.assign(item.existing, item.payload);
      else state.scheduleOverrides.push(item.payload);
      audit("schedule.override", "schedule_override", item.payload.id, `${item.payload.date} set to ${item.payload.statusId}`);
      await dataStore.upsertScheduleOverride(item.payload);
    }

    await saveState();
    ui.drawer = null;
    render();
  });
}

async function saveRotation(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const profile = byId(state.profiles, form.get("profileId"));
  if (!profile || !canManageDepartment(profile.departmentId)) return;
  const pattern = sanitizeRotationPattern(form.getAll("patternItem").map((item) => item.trim()).filter(Boolean));
  const validIds = new Set(rotationStatusIds);
  const invalid = pattern.find((statusId) => !validIds.has(statusId));
  if (invalid) {
    notify(`Unknown status key: ${invalid}`);
    return;
  }
  const existing = event.submitter?.value === "new-version" ? null : byId(state.rotationVersions, ui.drawer.rotationId);
  const payload = { id: existing?.id || makeId("rot"), profileId: form.get("profileId"), effectiveStart: form.get("effectiveStart"), pattern };
  await runMutation("rotation-save", {
    pending: "Saving rotation...",
    success: existing ? "Rotation saved." : "Rotation created.",
    failure: "The rotation could not be saved."
  }, async () => {
    if (existing) Object.assign(existing, payload);
    else state.rotationVersions.push(payload);
    audit("rotation.saved", "rotation_version", payload.id, `${payload.pattern.length} day pattern`);
    await dataStore.upsertRotation(payload);
    await saveState();
    ui.drawer = null;
    render();
  });
}

async function saveDepartmentRotations(event) {
  event.preventDefault();
  if (!canManageDepartment(ui.selectedDepartmentId) || !ui.selectedRotationProfileIds.length) return;
  const form = new FormData(event.currentTarget);
  const effectiveStart = form.get("effectiveStart");
  const pattern = sanitizeRotationPattern(ui.rotationBulkPattern);
  const selectedProfiles = ui.selectedRotationProfileIds.map((id) => byId(state.profiles, id)).filter(Boolean);
  if (selectedProfiles.some((profile) => !profileBelongsToDepartment(profile, ui.selectedDepartmentId))) {
    notify("Every selected person must belong to this department.");
    return;
  }
  if (selectedProfiles.some((profile) => state.rotationVersions.some((rotation) => rotation.profileId === profile.id && rotation.effectiveStart === effectiveStart))) {
    notify("One or more selected people already have a rotation starting on that date. Choose another effective date.");
    return;
  }

  const patterns = selectedProfiles.map((profile) => ({ profileId: profile.id, pattern }));
  await runMutation("department-rotations", {
    pending: "Saving department rotations...",
    success: `Saved ${patterns.length} ${patterns.length === 1 ? "rotation" : "rotations"}.`,
    failure: "The department rotations could not be saved."
  }, async () => {
    const rotations = await dataStore.saveDepartmentRotations(ui.selectedDepartmentId, effectiveStart, patterns);
    state.rotationVersions.push(...rotations);
    rotations.forEach((rotation) => audit("rotation.saved", "rotation_version", rotation.id, `${rotation.pattern.length} day department pattern`));
    await saveState();
    ui.rotationDepartmentEdit = false;
    ui.rotationBulkEditing = false;
    ui.selectedRotationProfileIds = [];
    ui.drawer = null;
    render();
  });
}

async function saveStatus(event) {
  event.preventDefault();
  if (!canManageSystemSettings()) return;
  const form = new FormData(event.currentTarget);
  const existing = byId(state.statuses, ui.drawer.statusId);
  const payload = {
    id: String(form.get("id")).trim().toLowerCase().replace(/\s+/g, "-"),
    label: form.get("label"),
    color: "#991b1b",
    kind: form.get("kind")
  };
  await runMutation("status-save", {
    pending: "Saving status...",
    success: existing ? "Status saved." : "Status created.",
    failure: "The status could not be saved."
  }, async () => {
    if (existing) Object.assign(existing, payload);
    else state.statuses.push(payload);
    audit("status.saved", "status", payload.id, payload.label);
    await dataStore.upsertStatus(payload);
    await saveState();
    ui.drawer = null;
    render();
  });
}

async function reloadState() {
  ui.loading = true;
  ui.error = "";
  render();
  try {
    state = await dataStore.load();
    ui.selectedDepartmentId = state.departments[0]?.id;
    syncHierarchyDepartmentSelection();
  } catch (error) {
    ui.error = error.message || "Unable to load live scheduler data.";
    if (/session|jwt|invalid|expired/i.test(ui.error)) {
      await dataStore.signOut();
      dataStore.session = null;
    }
  } finally {
    ui.loading = false;
    render();
  }
}

async function boot() {
  try {
    dataStore = await createSupabaseStore();
    state = await dataStore.load();
    ui.selectedDepartmentId = state.departments[0]?.id;
    syncHierarchyDepartmentSelection();
  } catch (error) {
    ui.error = error.message || "Unable to load scheduler.";
    if (dataStore?.mode === "supabase" && /session|jwt|invalid|expired/i.test(ui.error)) {
      await dataStore.signOut();
      dataStore.session = null;
    }
    if (appConfig.demoMode) {
      dataStore = {
        mode: "demo",
        async persist() {},
        async reset() {}
      };
      state = loadState();
      syncHierarchyDepartmentSelection();
    }
  } finally {
    ui.loading = false;
    render();
  }
}

boot();
