import "./styles.css";
import { appConfig } from "./config.js";
import { hasSupabaseConfig } from "./supabaseClient.js";
import {
  addPerson,
  clearDay,
  deactivatePerson,
  deleteOverride,
  getSession,
  linkProfile,
  loadProfile,
  loadScheduleData,
  onAuthChange,
  reviewRequest,
  signIn,
  signOut,
  submitRequest,
  updatePerson,
  updatePersonOrder,
  upsertDefault,
  upsertManagerDefault,
  upsertManagerOverride,
  upsertOverride
} from "./data.js";
import {
  dateKey,
  dayOverrideCount,
  getDaysInMonth,
  getManager,
  getShiftId,
  isTodayInView,
  managedDepartments,
  managerKey,
  managerScore,
  normalizeData,
  overrideKey,
  peopleByDepartment,
  shiftDayWindow,
  todayIsoKey,
  vacationCount,
  vacationRemaining,
  visibleDayCount,
  visibleDays
} from "./schedule.js";
import { canEditSchedule, canExportCsv, canManagePeople, canReviewRequests, canSubmitRequests, isAdmin } from "./permissions.js";

const root = document.querySelector("#app");

const state = {
  session: null,
  profile: null,
  data: null,
  year: appConfig.defaultMonth.year,
  month: appConfig.defaultMonth.month,
  dayStart: 1,
  compactMonth: false,
  view: "schedule",
  status: "",
  error: ""
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
  state.status = message;
  state.error = isError ? message : "";
  render();
}

function friendlyError(error) {
  const message = error?.message || "Something went wrong.";
  if (message.toLowerCase().includes("row-level security")) {
    return `${message}. Your signed-in profile must have role=admin and the latest Supabase policy migrations must be applied.`;
  }
  if (message.toLowerCase().includes("permission denied")) {
    return `${message}. Check Supabase table grants and RLS policies for the authenticated role.`;
  }
  return message;
}

async function run(action, message = "Saved.") {
  try {
    const result = await action();
    await refreshData(false);
    if (typeof result?.verify === "function") {
      result.verify();
    }
    setStatus(message);
  } catch (error) {
    setStatus(friendlyError(error), true);
  }
}

async function refreshData(shouldRender = true) {
  const raw = await loadScheduleData();
  state.data = normalizeData(raw);
  if (shouldRender) render();
}

async function boot() {
  if (!hasSupabaseConfig) {
    renderSetup();
    return;
  }

  try {
    state.session = await getSession();
    if (state.session?.user) {
      state.profile = await loadProfile(state.session.user.id);
      await refreshData(false);
    }
    onAuthChange(async (session) => {
      state.session = session;
      state.profile = session?.user ? await loadProfile(session.user.id) : null;
      state.data = null;
      if (session?.user) await refreshData(false);
      render();
    });
    render();
  } catch (error) {
    setStatus(friendlyError(error), true);
    render();
  }
}

function renderSetup() {
  root.innerHTML = `
    <main class="setup-wrap">
      <section class="panel auth-card">
        <h1>${appConfig.appName}</h1>
        <p>Add your Supabase credentials before running the app.</p>
        <pre class="status">Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</pre>
      </section>
    </main>
  `;
}

function renderAuth() {
  root.innerHTML = `
    <main class="auth-wrap">
      <section class="panel auth-card">
        <h1>${appConfig.appName}</h1>
        <p>Sign in with the email address your admin invited. Schedule data stays private until you are signed in.</p>
        <form id="signinForm">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" autocomplete="email" required>
          </div>
          <button class="button primary" type="submit">Send sign-in link</button>
        </form>
        ${state.status ? `<p class="status ${state.error ? "is-error" : ""}">${escapeHtml(state.status)}</p>` : ""}
      </section>
    </main>
  `;
}

function render() {
  if (!hasSupabaseConfig) {
    renderSetup();
    return;
  }

  if (!state.session?.user) {
    renderAuth();
    return;
  }

  if (!state.data || !state.profile) {
    root.innerHTML = `
      <main class="auth-wrap">
        <section class="panel auth-card">
          <h1>${appConfig.appName}</h1>
          <p class="status ${state.error ? "is-error" : ""}">${escapeHtml(state.error || "Loading schedule...")}</p>
          ${state.error ? `<button class="button" id="signOut" type="button">Sign out</button>` : ""}
        </section>
      </main>
    `;
    return;
  }

  const tabs = [
    ["schedule", "Month", true],
    ["defaults", "Defaults", canEditSchedule(state.profile)],
    ["people", "People", canManagePeople(state.profile)],
    ["requests", "Requests", true],
    ["account", "Account", true]
  ].filter((tab) => tab[2]);

  if (!tabs.some(([view]) => view === state.view)) state.view = "schedule";

  root.innerHTML = `
    <main class="app">
      <div class="shell">
        <header class="topbar">
          <div class="title-block">
            <h1>${appConfig.appName}</h1>
            <p>${isAdmin(state.profile)
              ? "Manage the live schedule, weekly defaults, team accounts, and time-off approvals."
              : "View the team schedule and send vacation or sick leave requests for admin review."}</p>
          </div>
          <div class="today-card" ${state.view === "schedule" ? "" : "hidden"}>
            <div class="today-day">Today</div>
            <div class="today-date">${new Date().toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</div>
          </div>
          <div class="actions">
            <span class="chip">${escapeHtml(state.profile.email)}</span>
            ${canExportCsv(state.profile) ? `<button class="button primary" id="exportCsv" type="button">Export CSV</button>` : ""}
            <button class="button" id="refreshApp" type="button">Refresh</button>
            <button class="button" id="signOut" type="button">Sign out</button>
          </div>
        </header>

        <section class="layout">
          <aside class="panel sidebar">
            <div class="tabs" role="tablist" aria-label="Views">
              ${tabs.map(([view, label]) => `<button class="tab ${state.view === view ? "active" : ""}" data-view="${view}" type="button">${label}</button>`).join("")}
            </div>
          </aside>
          <section class="panel content">
            ${state.view === "schedule" ? renderScheduleView() : ""}
            ${state.view === "defaults" ? renderDefaultsView() : ""}
            ${state.view === "people" ? renderPeopleView() : ""}
            ${state.view === "requests" ? renderRequestsView() : ""}
            ${state.view === "account" ? renderAccountView() : ""}
          </section>
        </section>
        ${state.status ? `<p class="status ${state.error ? "is-error" : ""}">${escapeHtml(state.status)}</p>` : ""}
      </div>
    </main>
  `;
}

function renderScheduleView() {
  return `
    <div class="monthbar">
      <div class="month-picker">
        <button class="icon-button" id="prevMonth" type="button" aria-label="Previous month">&#8249;</button>
        <div class="month-title">${new Date(state.year, state.month, 1).toLocaleDateString("en", { month: "long", year: "numeric" })}</div>
        <button class="icon-button" id="nextMonth" type="button" aria-label="Next month">&#8250;</button>
      </div>
      <div class="day-walker">
        <button class="icon-button" id="prevDays" type="button" aria-label="Previous days">&#8592;</button>
        <span id="dayWindowLabel">${dayWindowLabel()}</span>
        <button class="icon-button" id="nextDays" type="button" aria-label="Next days">&#8594;</button>
      </div>
      <button class="button" id="compactMonth" type="button">Compact ${state.compactMonth ? "on" : "off"}</button>
      <div class="legend">${state.data.shiftTypes.map((shift) => `<span class="chip"><span class="dot" style="--dot: ${shift.color}"></span>${escapeHtml(shift.label)}</span>`).join("")}</div>
    </div>
    <div class="schedule-wrap">${renderMonthTable()}</div>
  `;
}

function dayWindowLabel() {
  const days = visibleDays(state);
  const first = new Date(state.year, state.month, days[0]);
  const last = new Date(state.year, state.month, days[days.length - 1]);
  return `${first.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} - ${last.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
}

function renderMonthTable() {
  if (!state.data.people.length) return `<div class="empty-state">Ask an admin to add people to the schedule.</div>`;

  const days = visibleDays(state);
  const editable = canEditSchedule(state.profile);
  const head = days.map((day) => {
    const date = new Date(state.year, state.month, day);
    const overrides = dayOverrideCount(state.data, state.year, state.month, day);
    return `
      <th class="${isTodayInView(state, day) ? "today-header" : ""}">
        <span>${appConfig.weekdays[date.getDay()]}</span>
        <span class="date">${state.month + 1}/${day}/${state.year}</span>
        ${editable ? `<button class="clear-day ${overrides ? "has-overrides" : ""}" data-clear-day="${day}" type="button">${overrides ? `Clear ${overrides}` : "Clear"}</button>${managerControlsForDay(day)}` : ""}
      </th>
    `;
  }).join("");

  const body = state.compactMonth
    ? [...state.data.people]
      .sort((a, b) => managerScore(state.data, b, days, state.year, state.month) - managerScore(state.data, a, days, state.year, state.month))
      .map((person) => `<tr><td>${renderPersonCell(person, true)}</td>${renderMonthCells(person, days)}</tr>`)
      .join("")
    : state.data.departments.map((department) => {
      const rows = peopleByDepartment(state.data, department.id)
        .sort((a, b) => managerScore(state.data, b, days, state.year, state.month) - managerScore(state.data, a, days, state.year, state.month))
        .map((person) => `<tr><td>${renderPersonCell(person)}</td>${renderMonthCells(person, days)}</tr>`)
        .join("");
      if (!rows) return "";
      return `<tr class="department-divider" style="--dept: ${department.color}"><td colspan="${days.length + 1}">${escapeHtml(department.name)}</td></tr>${rows}`;
    }).join("");

  return `<table><thead><tr><th>Names</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderMonthCells(person, days) {
  return days.map((day) => {
    const isoDate = dateKey(state.year, state.month, day);
    const shiftId = getShiftId(state.data, person, state.year, state.month, day);
    const shift = state.data.shiftsById[shiftId] || state.data.shiftTypes[0];
    const isOverride = Boolean(state.data.overridesByKey[overrideKey(person.id, isoDate)]);
    const managers = managedDepartments(state.data, person.id, state.year, state.month, day);
    const editable = canEditSchedule(state.profile);
    return `
      <td>
        <button
          class="shift-cell ${managers.length ? "is-manager" : ""}"
          type="button"
          style="--shift: ${shift?.color || "#6f927b"}"
          ${editable ? `data-person="${person.id}" data-day="${day}"` : "disabled"}
          data-override="${isOverride}"
          title="${editable ? "Click to cycle" : "Read only"} ${escapeHtml(person.name)} on ${isoDate}"
        >${escapeHtml(shift?.label || "Shift")}${managers.length ? `<span class="manager-mini">Mgr</span>` : ""}</button>
      </td>
    `;
  }).join("");
}

function renderPersonCell(person, compact = false) {
  const department = person.department;
  return `
    <div class="person-cell ${compact ? "compact" : ""}" style="--dept: ${department?.color || "var(--accent)"}">
      <span class="person-cell-name">${escapeHtml(person.name)}</span>
      ${compact ? "" : `
        <span class="person-cell-meta">${escapeHtml(person.title)} / ${escapeHtml(department?.name || "No department")}</span>
        <span class="person-cell-meta">Vacation ${vacationRemaining(state.data, person, state.year, state.month)}/${person.vacation_limit}</span>
      `}
    </div>
  `;
}

function managerControlsForDay(day) {
  const isoDate = dateKey(state.year, state.month, day);
  const departments = state.data.departments.filter((department) => department.manager_enabled);
  if (!departments.length) return "";
  return `
    <details class="manager-menu">
      <summary>Managers</summary>
      <div class="manager-panel">
        ${departments.map((department) => {
          const selected = getManager(state.data, department.id, state.year, state.month, day);
          return `
            <label class="manager-compact">
              <span>${escapeHtml(department.name)}</span>
              <select data-manager-override="${department.id}" data-date="${isoDate}">
                ${personOptions(selected, department.id)}
              </select>
            </label>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function personOptions(selectedId, departmentId = "") {
  const people = departmentId ? peopleByDepartment(state.data, departmentId) : state.data.people;
  return `<option value="">Unassigned</option>${people.map((person) => `<option value="${person.id}" ${selectedId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>`).join("")}`;
}

function personEmail(person) {
  return person?.email || person?.profile?.email || "";
}

function personPicture(person) {
  return person?.picture_url || "";
}

function renderDefaultsView() {
  if (!canEditSchedule(state.profile)) return `<div class="empty-state">Only admins can edit defaults.</div>`;
  if (!state.data.people.length) return `<div class="empty-state">Add someone to define a regular weekly pattern.</div>`;

  const defaultEligible = state.data.shiftTypes.filter((shift) => shift.default_eligible);
  const head = appConfig.defaultDayOrder.map((weekday) => `<th>${appConfig.weekdays[weekday]}${managerControlsForDefault(weekday)}</th>`).join("");
  const body = state.data.departments.map((department) => {
    const rows = peopleByDepartment(state.data, department.id).map((person) => {
      const cells = appConfig.defaultDayOrder.map((weekday) => {
        const shift = state.data.shiftsById[person.defaults[weekday]] || defaultEligible[0] || state.data.shiftTypes[0];
        const managerDepartmentsForDay = state.data.departments.filter((item) => item.manager_enabled && state.data.managerDefaultsByKey[managerKey(item.id, weekday)] === person.id);
        return `
          <td>
            <button class="default-shift-cell ${managerDepartmentsForDay.length ? "is-manager" : ""}" type="button" style="--shift: ${shift?.color}" data-default-person="${person.id}" data-weekday="${weekday}">
              ${escapeHtml(shift?.label || "Shift")}${managerDepartmentsForDay.length ? `<span class="manager-mini">Mgr</span>` : ""}
            </button>
          </td>
        `;
      }).join("");
      return `<tr><td>${renderPersonCell(person)}</td>${cells}</tr>`;
    }).join("");
    if (!rows) return "";
    return `<tr class="department-divider" style="--dept: ${department.color}"><td colspan="8">${escapeHtml(department.name)}</td></tr>${rows}`;
  }).join("");

  return `
    <div class="defaults-actions">
      <span class="chip">Defaults cycle through: ${defaultEligible.map((shift) => escapeHtml(shift.label)).join(", ")}</span>
    </div>
    <div class="default-grid"><table><thead><tr><th>Column 1</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  `;
}

function managerControlsForDefault(weekday) {
  const departments = state.data.departments.filter((department) => department.manager_enabled);
  if (!departments.length) return "";
  return `
    <div class="manager-defaults-inline">
      ${departments.map((department) => {
        const selected = state.data.managerDefaultsByKey[managerKey(department.id, weekday)] || "";
        return `
          <label>
            <span>${escapeHtml(department.name.slice(0, 2))}</span>
            <select data-manager-default="${department.id}" data-weekday="${weekday}">
              ${personOptions(selected, department.id)}
            </select>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function renderPeopleView() {
  const addCard = `
    <div class="people-section">
      <div class="people-section-title" style="--dept: var(--accent)">New Staff</div>
      <div class="people-section-grid">
        <form class="person-row add-person-card" id="addPersonForm" style="--dept: var(--accent)">
          <div>
            <div class="person-name">Add person</div>
            <div class="tiny">Create a staff profile, then link an invited account below.</div>
          </div>
          <div class="person-edit">
            <input id="newPerson" type="text" placeholder="Name" required>
            <input id="newTitle" type="text" placeholder="Title">
            <select id="newDepartment" required>${state.data.departments.map((department) => `<option value="${department.id}">${escapeHtml(department.name)}</option>`).join("")}</select>
            <input id="newVacationLimit" type="number" min="0" value="${appConfig.vacationLimit}">
            <button class="button primary" type="submit">Add to schedule</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const sections = state.data.departments.map((department) => {
    const people = peopleByDepartment(state.data, department.id);
    if (!people.length) return "";
    return `
      <div class="people-section">
        <div class="people-section-title" style="--dept: ${department.color}">${escapeHtml(department.name)}</div>
        <div class="people-section-grid">${people.map((person) => renderPersonCard(person)).join("")}</div>
      </div>
    `;
  }).join("");

  return `<div class="people-view"><div class="people-grid">${addCard}${sections}</div></div>`;
}

function renderPersonCard(person) {
  const remaining = vacationRemaining(state.data, person, state.year, state.month);
  const vacations = vacationCount(state.data, person, state.year, state.month);
  const fill = person.vacation_limit ? Math.min(100, Math.round((remaining / person.vacation_limit) * 100)) : 0;
  const group = peopleByDepartment(state.data, person.department_id);
  const index = group.findIndex((item) => item.id === person.id);
  return `
    <div class="person-row" style="--dept: ${person.department?.color || "var(--accent)"}">
      <div class="person-head">
        <div>
          <div class="person-name">${escapeHtml(person.name)}</div>
          <div class="person-meta">
            <span class="meta-pill">${escapeHtml(person.title)}</span>
            <span class="meta-pill department">${escapeHtml(person.department?.name || "No department")}</span>
          </div>
        </div>
        <div class="person-tools">
          <button class="tool-button" data-move-person="${person.id}" data-direction="-1" type="button" ${index === 0 ? "disabled" : ""}>&#8593;</button>
          <button class="tool-button" data-move-person="${person.id}" data-direction="1" type="button" ${index === group.length - 1 ? "disabled" : ""}>&#8595;</button>
          <button class="remove" data-remove-person="${person.id}" type="button">x</button>
        </div>
      </div>
      <div class="person-edit">
        <input data-person-name="${person.id}" value="${escapeHtml(person.name)}" aria-label="Name">
        <input data-person-email="${person.id}" type="email" value="${escapeHtml(personEmail(person))}" placeholder="Email" aria-label="Email">
        <input data-person-picture="${person.id}" value="${escapeHtml(personPicture(person))}" placeholder="Picture URL" aria-label="Picture URL">
        <input data-person-title="${person.id}" value="${escapeHtml(person.title)}" aria-label="Title">
        <select data-person-department="${person.id}">${state.data.departments.map((department) => `<option value="${department.id}" ${person.department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select>
        <input data-person-vacation-limit="${person.id}" type="number" min="0" value="${person.vacation_limit}">
      </div>
      <div class="vacation-meter ${vacations > person.vacation_limit ? "is-over" : ""}">
        <div class="meter-line"><span>Vacation left</span><span>${remaining}/${person.vacation_limit}</span></div>
        <div class="meter-track"><div class="meter-fill" style="--fill: ${fill}%"></div></div>
      </div>
    </div>
  `;
}

function renderRequestsView() {
  const person = state.data.people.find((item) => item.id === state.profile.person_id);
  const requestForm = canSubmitRequests(state.profile) ? `
    <form class="request-card request-form" id="requestForm" style="--dept: ${person?.department?.color || "var(--accent)"}">
      <div>
        <div class="request-title">New request</div>
        <div class="tiny">Vacation and sick leave requests go to admins before they change the schedule.</div>
      </div>
      <select id="requestType">${appConfig.requestTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.label)}</option>`).join("")}</select>
      <input id="requestStart" type="date" value="${todayIsoKey()}" required>
      <input id="requestEnd" type="date" value="${todayIsoKey()}" required>
      <textarea id="requestNote" placeholder="Optional note"></textarea>
      <button class="button primary" type="submit">Send request</button>
    </form>
  ` : `<div class="request-card"><div class="request-title">No linked person</div><p class="status">Ask an admin to link your account before submitting requests.</p></div>`;

  const requests = canReviewRequests(state.profile)
    ? state.data.requests
    : state.data.requests.filter((request) => request.user_id === state.session.user.id);

  return `
    <div class="viewbar"><span class="chip">${canReviewRequests(state.profile) ? "Admin queue" : "My requests"}</span></div>
    <div class="requests-view">
      <div class="request-grid">
        ${requestForm}
        ${requests.length ? requests.map((request) => renderRequestCard(request)).join("") : `<div class="empty-state">No requests yet.</div>`}
      </div>
    </div>
  `;
}

function renderRequestCard(request) {
  const person = state.data.people.find((item) => item.id === request.person_id);
  const requestType = appConfig.requestTypes.find((item) => item.id === request.request_type);
  const pendingAdmin = canReviewRequests(state.profile) && request.status === "pending";
  return `
    <div class="request-card" style="--dept: ${person?.department?.color || "var(--accent)"}">
      <div class="request-head">
        <div>
          <div class="request-title">${escapeHtml(person?.name || "Unknown person")}</div>
          <div class="request-meta">
            <span class="meta-pill">${escapeHtml(requestType?.label || request.request_type)}</span>
            <span class="meta-pill">${escapeHtml(request.status)}</span>
          </div>
        </div>
      </div>
      <div class="tiny">${escapeHtml(request.start_date)} to ${escapeHtml(request.end_date)}</div>
      ${request.note ? `<div class="status">${escapeHtml(request.note)}</div>` : ""}
      ${request.admin_note ? `<div class="status">Admin: ${escapeHtml(request.admin_note)}</div>` : ""}
      ${pendingAdmin ? `
        <textarea data-request-note="${request.id}" placeholder="Optional admin note"></textarea>
        <div class="inline-actions">
          <button class="button primary" data-approve-request="${request.id}" type="button">Approve</button>
          <button class="button danger" data-reject-request="${request.id}" type="button">Reject</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderAccountView() {
  const myPerson = state.data.people.find((person) => person.id === state.profile.person_id);
  const selfLinker = !myPerson && canManagePeople(state.profile) ? `
    <div class="account-card">
      <div class="request-title">Link your account</div>
      <p class="status">Choose the staff profile that belongs to ${escapeHtml(state.profile.email)}.</p>
      <select data-profile-person="${state.profile.id}">
        ${personOptions(state.profile.person_id)}
      </select>
      <input type="hidden" data-profile-role="${state.profile.id}" value="${escapeHtml(state.profile.role)}">
    </div>
  ` : "";
  const linker = canManagePeople(state.profile) ? `
    <div class="account-card">
      <div class="request-title">Account links</div>
      <div class="profile-linker">
        ${state.data.profiles.map((profile) => `
          <div class="person-edit">
            <label>${escapeHtml(profile.email)}</label>
            <select data-profile-person="${profile.id}">
              ${personOptions(profile.person_id)}
            </select>
            <select data-profile-role="${profile.id}">
              <option value="member" ${profile.role === "member" ? "selected" : ""}>member</option>
              <option value="admin" ${profile.role === "admin" ? "selected" : ""}>admin</option>
            </select>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  return `
    <div class="account-view">
      <div class="account-grid">
        ${myPerson ? renderMyProfileCard(myPerson) : renderUnlinkedProfileCard()}
        ${selfLinker}
        ${linker}
      </div>
    </div>
  `;
}

function renderUnlinkedProfileCard() {
  return `
    <div class="account-card profile-card">
      <div class="profile-main">
        <div class="avatar-placeholder">${escapeHtml((state.profile.email || "?").slice(0, 1).toUpperCase())}</div>
        <div>
          <div class="request-title">${escapeHtml(state.profile.display_name || state.profile.email)}</div>
          <div class="person-meta">
            <span class="meta-pill">${escapeHtml(state.profile.role)}</span>
            <span class="meta-pill">No person linked</span>
          </div>
        </div>
      </div>
      <p class="status">Link this account to a staff profile to show name, email, picture, vacation days, title, department, and schedule.</p>
    </div>
  `;
}

function renderMyProfileCard(person) {
  const remaining = vacationRemaining(state.data, person, state.year, state.month);
  const used = vacationCount(state.data, person, state.year, state.month);
  const picture = personPicture(person);
  return `
    <div class="account-card profile-card">
      <div class="profile-main">
        ${picture
          ? `<img class="profile-photo" src="${escapeHtml(picture)}" alt="${escapeHtml(person.name)}">`
          : `<div class="avatar-placeholder">${escapeHtml(person.name.slice(0, 1).toUpperCase())}</div>`}
        <div>
          <div class="request-title">${escapeHtml(person.name)}</div>
          <div class="person-meta">
            <span class="meta-pill">${escapeHtml(state.profile.role)}</span>
            <span class="meta-pill">${escapeHtml(person.department?.name || "No department")}</span>
            <span class="meta-pill">${escapeHtml(person.title)}</span>
          </div>
          <div class="tiny">${escapeHtml(personEmail(person) || state.profile.email)}</div>
        </div>
      </div>
      <div class="person-edit profile-edit">
        <label>Name<input data-person-name="${person.id}" value="${escapeHtml(person.name)}"></label>
        <label>Email<input data-person-email="${person.id}" type="email" value="${escapeHtml(personEmail(person))}" placeholder="${escapeHtml(state.profile.email)}"></label>
        <label>Picture URL<input data-person-picture="${person.id}" value="${escapeHtml(personPicture(person))}" placeholder="https://..."></label>
        <label>Title<input data-person-title="${person.id}" value="${escapeHtml(person.title)}"></label>
        <label>Department<select data-person-department="${person.id}">${state.data.departments.map((department) => `<option value="${department.id}" ${person.department_id === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}</select></label>
        <label>Vacation days<input data-person-vacation-limit="${person.id}" type="number" min="0" value="${person.vacation_limit}"></label>
      </div>
      <div class="vacation-meter">
        <div class="meter-line"><span>Vacation this month</span><span>${used} used / ${remaining} left / ${person.vacation_limit} total</span></div>
        <div class="meter-track"><div class="meter-fill" style="--fill: ${person.vacation_limit ? Math.min(100, Math.round((remaining / person.vacation_limit) * 100)) : 0}%"></div></div>
      </div>
      ${renderPersonalSchedule(person)}
    </div>
  `;
}

function renderPersonalSchedule(person) {
  const days = visibleDays(state);
  return `
    <div class="profile-schedule">
      <div class="request-title">Schedule</div>
      <div class="profile-schedule-grid">
        ${days.map((day) => {
          const isoDate = dateKey(state.year, state.month, day);
          const shift = state.data.shiftsById[getShiftId(state.data, person, state.year, state.month, day)];
          const date = new Date(state.year, state.month, day);
          return `
            <div class="profile-shift" style="--shift: ${shift?.color || "#6f927b"}">
              <span>${escapeHtml(appConfig.weekdays[date.getDay()].slice(0, 3))}</span>
              <strong>${escapeHtml(shift?.label || "Shift")}</strong>
              <small>${escapeHtml(isoDate)}</small>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

async function cycleShift(personId, day) {
  const person = state.data.people.find((item) => item.id === personId);
  if (!person) return;
  const isoDate = dateKey(state.year, state.month, day);
  const current = getShiftId(state.data, person, state.year, state.month, day);
  const shifts = state.data.shiftTypes;
  const currentIndex = shifts.findIndex((shift) => shift.id === current);
  const next = shifts[(currentIndex + 1) % shifts.length];
  const defaultShift = person.defaults[new Date(state.year, state.month, day).getDay()];

  if (next.id === defaultShift) {
    const rpcResult = await deleteOverride(person.id, isoDate);
    return {
      verify() {
        const key = overrideKey(person.id, isoDate);
        if (state.data.overridesByKey[key]) {
          throw new Error(`Shift delete RPC returned ${JSON.stringify(rpcResult)}, but ${isoDate} still has an override after reload.`);
        }
      }
    };
  } else {
    const rpcResult = await upsertOverride(person.id, isoDate, next.id);
    return {
      verify() {
        const key = overrideKey(person.id, isoDate);
        const reloadedShift = state.data.overridesByKey[key];
        if (reloadedShift !== next.id) {
          throw new Error(`Shift RPC returned ${JSON.stringify(rpcResult)}, but schedule_overrides reloaded ${reloadedShift || "nothing"} for ${isoDate}; expected ${next.id}.`);
        }
      }
    };
  }
}

async function cycleDefault(personId, weekday) {
  const person = state.data.people.find((item) => item.id === personId);
  const shifts = state.data.shiftTypes.filter((shift) => shift.default_eligible);
  if (!person || !shifts.length) return;
  const current = person.defaults[weekday];
  const currentIndex = shifts.findIndex((shift) => shift.id === current);
  const next = shifts[(currentIndex + 1) % shifts.length] || shifts[0];
  await upsertDefault(person.id, weekday, next.id);
}

function exportCsv() {
  const days = Array.from({ length: getDaysInMonth(state.year, state.month) }, (_, index) => index + 1);
  const managerDepartments = state.data.departments.filter((department) => department.manager_enabled);
  const rows = [
    ["Name", "Title", "Department", "Vacation Remaining", ...days.map((day) => dateKey(state.year, state.month, day))],
    ...managerDepartments.map((department) => [
      `${department.name} Manager`,
      "Shift Manager",
      department.name,
      "",
      ...days.map((day) => {
        const manager = state.data.people.find((person) => person.id === getManager(state.data, department.id, state.year, state.month, day));
        return manager ? manager.name : "Unassigned";
      })
    ]),
    ...state.data.people.map((person) => [
      person.name,
      person.title,
      person.department?.name || "",
      `${vacationRemaining(state.data, person, state.year, state.month)}/${person.vacation_limit}`,
      ...days.map((day) => state.data.shiftsById[getShiftId(state.data, person, state.year, state.month, day)]?.label || "")
    ])
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shift-loom-${state.year}-${String(state.month + 1).padStart(2, "0")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("submit", async (event) => {
  if (event.target.id === "signinForm") {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim();
    try {
      await signIn(email);
      setStatus("Check your email for the sign-in link.");
    } catch (error) {
      setStatus(friendlyError(error), true);
    }
  }

  if (event.target.id === "addPersonForm") {
    event.preventDefault();
    await run(async () => {
      const defaultShift = state.data.shiftTypes.find((shift) => shift.default_eligible)?.id || state.data.shiftTypes[0]?.id;
      await addPerson({
        name: document.querySelector("#newPerson").value.trim(),
        title: document.querySelector("#newTitle").value.trim() || "Team Member",
        departmentId: document.querySelector("#newDepartment").value,
        vacationLimit: Number(document.querySelector("#newVacationLimit").value) || appConfig.vacationLimit,
        displayOrder: state.data.people.length * 10 + 10
      }, defaultShift);
    }, "Person added.");
  }

  if (event.target.id === "requestForm") {
    event.preventDefault();
    await run(async () => {
      const startDate = document.querySelector("#requestStart").value;
      const endDate = document.querySelector("#requestEnd").value;
      if (endDate < startDate) throw new Error("End date must be after start date.");
      await submitRequest({
        person_id: state.profile.person_id,
        user_id: state.session.user.id,
        request_type: document.querySelector("#requestType").value,
        start_date: startDate,
        end_date: endDate,
        note: document.querySelector("#requestNote").value.trim()
      });
    }, "Request sent.");
  }
});

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    render();
    return;
  }

  if (event.target.closest("#signOut")) {
    await signOut();
    return;
  }

  if (event.target.closest("#refreshApp")) {
    await run(async () => {}, "Refreshed.");
    return;
  }

  if (event.target.closest("#exportCsv")) {
    exportCsv();
    return;
  }

  if (event.target.closest("#prevMonth")) {
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    state.dayStart = 1;
    render();
    return;
  }

  if (event.target.closest("#nextMonth")) {
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    state.dayStart = 1;
    render();
    return;
  }

  if (event.target.closest("#prevDays")) {
    shiftDayWindow(state, -visibleDayCount());
    render();
    return;
  }

  if (event.target.closest("#nextDays")) {
    shiftDayWindow(state, visibleDayCount());
    render();
    return;
  }

  if (event.target.closest("#compactMonth")) {
    state.compactMonth = !state.compactMonth;
    render();
    return;
  }

  const shiftButton = event.target.closest("[data-person][data-day]");
  if (shiftButton) {
    await run(() => cycleShift(shiftButton.dataset.person, Number(shiftButton.dataset.day)), "Shift updated.");
    return;
  }

  const defaultButton = event.target.closest("[data-default-person][data-weekday]");
  if (defaultButton) {
    await run(() => cycleDefault(defaultButton.dataset.defaultPerson, Number(defaultButton.dataset.weekday)), "Default updated.");
    return;
  }

  const clearButton = event.target.closest("[data-clear-day]");
  if (clearButton) {
    await run(() => clearDay(dateKey(state.year, state.month, Number(clearButton.dataset.clearDay))), "Day cleared.");
    return;
  }

  const removeButton = event.target.closest("[data-remove-person]");
  if (removeButton) {
    await run(() => deactivatePerson(removeButton.dataset.removePerson), "Person deactivated.");
    return;
  }

  const moveButton = event.target.closest("[data-move-person][data-direction]");
  if (moveButton) {
    await run(async () => {
      const person = state.data.people.find((item) => item.id === moveButton.dataset.movePerson);
      const group = peopleByDepartment(state.data, person.department_id);
      const index = group.findIndex((item) => item.id === person.id);
      const next = group[index + Number(moveButton.dataset.direction)];
      if (!next) return;
      await updatePersonOrder([
        { id: person.id, display_order: next.display_order },
        { id: next.id, display_order: person.display_order }
      ]);
    }, "Order updated.");
    return;
  }

  const approve = event.target.closest("[data-approve-request]");
  const reject = event.target.closest("[data-reject-request]");
  if (approve || reject) {
    const requestId = (approve || reject).dataset.approveRequest || (approve || reject).dataset.rejectRequest;
    const request = state.data.requests.find((item) => item.id === requestId);
    const requestType = appConfig.requestTypes.find((item) => item.id === request.request_type);
    const note = document.querySelector(`[data-request-note="${requestId}"]`)?.value.trim() || "";
    await run(() => reviewRequest(request, approve ? "approved" : "rejected", note, state.session.user.id, requestType.shiftTypeId), approve ? "Request approved." : "Request rejected.");
  }
});

document.addEventListener("change", async (event) => {
  const nameInput = event.target.closest("[data-person-name]");
  if (nameInput) {
    await run(() => updatePerson(nameInput.dataset.personName, { name: nameInput.value.trim() || "Unnamed" }), "Person updated.");
    return;
  }

  const emailInput = event.target.closest("[data-person-email]");
  if (emailInput) {
    await run(() => updatePerson(emailInput.dataset.personEmail, { email: emailInput.value.trim() }), "Email updated.");
    return;
  }

  const pictureInput = event.target.closest("[data-person-picture]");
  if (pictureInput) {
    await run(() => updatePerson(pictureInput.dataset.personPicture, { picture_url: pictureInput.value.trim() }), "Picture updated.");
    return;
  }

  const titleInput = event.target.closest("[data-person-title]");
  if (titleInput) {
    await run(() => updatePerson(titleInput.dataset.personTitle, { title: titleInput.value.trim() || "Team Member" }), "Person updated.");
    return;
  }

  const departmentSelect = event.target.closest("[data-person-department]");
  if (departmentSelect) {
    await run(() => updatePerson(departmentSelect.dataset.personDepartment, { department_id: departmentSelect.value }), "Person updated.");
    return;
  }

  const vacationInput = event.target.closest("[data-person-vacation-limit]");
  if (vacationInput) {
    await run(() => updatePerson(vacationInput.dataset.personVacationLimit, { vacation_limit: Math.max(0, Number(vacationInput.value) || 0) }), "Person updated.");
    return;
  }

  const managerDefault = event.target.closest("[data-manager-default][data-weekday]");
  if (managerDefault) {
    await run(() => upsertManagerDefault(managerDefault.dataset.managerDefault, Number(managerDefault.dataset.weekday), managerDefault.value), "Manager default updated.");
    return;
  }

  const managerOverride = event.target.closest("[data-manager-override][data-date]");
  if (managerOverride) {
    await run(() => upsertManagerOverride(managerOverride.dataset.managerOverride, managerOverride.dataset.date, managerOverride.value), "Manager override updated.");
    return;
  }

  const profilePerson = event.target.closest("[data-profile-person]");
  const profileRole = event.target.closest("[data-profile-role]");
  if (profilePerson || profileRole) {
    const profileId = (profilePerson || profileRole).dataset.profilePerson || (profilePerson || profileRole).dataset.profileRole;
    const personId = document.querySelector(`[data-profile-person="${profileId}"]`).value;
    const role = document.querySelector(`[data-profile-role="${profileId}"]`).value;
    await run(() => linkProfile(profileId, personId, role), "Profile linked.");
  }
});

boot();
