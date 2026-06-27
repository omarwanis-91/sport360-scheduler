import { appConfig, supabaseConfig } from "./config.js";
import { seedState } from "./data.js";

const profilePhotoPrefix = "storage:profile-photos/";

export function shouldUseSupabase() {
  return Boolean(!appConfig.demoMode && supabaseConfig.url && supabaseConfig.anonKey);
}

export async function createSupabaseStore() {
  return shouldUseSupabase() ? createRemoteStore(createRestClient()) : createLocalStore();
}

function createLocalStore() {
  const storageKey = "sport360-scheduler-state";
  return {
    mode: "demo",
    async load() {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : structuredClone(seedState);
    },
    async persist(state) {
      localStorage.setItem(storageKey, JSON.stringify(state));
    },
    async reset() {
      localStorage.removeItem(storageKey);
    },
    async signIn() {},
    async signUp() {},
    async signOut() {},
    async createProfile() {},
    async updateProfile() {},
    async updateOwnProfile() {},
    async setProfileDepartments() {},
    async upsertUserRole() {},
    async unlinkProfileAccount() {},
    async upsertDepartment() {},
    async deleteDepartment() {},
    async upsertScheduleOverride() {},
    async deleteScheduleOverride() {},
    async createVacationRequest() {},
    async updateVacationDecision() {},
    async upsertDailyLead() {},
    async deleteDailyLead() {},
    async upsertDepartmentLeadRotation() {},
    async upsertRotation() {},
    async saveDepartmentRotations(departmentId, effectiveStart, patterns) {
      return patterns.map((item) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `rot-${Math.random().toString(36).slice(2, 8)}`,
        profileId: item.profileId,
        effectiveStart,
        pattern: [...item.pattern]
      }));
    },
    async upsertStatus() {},
    async uploadProfilePhoto(profileId, file, dataUrl) {
      return { reference: dataUrl, url: dataUrl };
    },
    async deleteProfilePhoto() {},
    async insertAudit() {}
  };
}

function createRemoteStore(client) {
  return {
    mode: "supabase",
    client,
    session: null,
    async load() {
      this.session = client.getSession();
      if (!this.session) return emptyState();

      await claimProfileForSession(client, this.session);
      return loadRemoteState(client, this.session);
    },
    async persist() {},
    async reset() {
      client.clearSession();
    },
    async signIn(email, password) {
      const data = await client.signIn(email, password);
      client.setSession(data);
      this.session = client.getSession();
      return data;
    },
    async signUp(email, password) {
      const data = await client.signUp(email, password);
      if (data.access_token) client.setSession(data);
      this.session = client.getSession();
      return data;
    },
    async signOut() {
      client.clearSession();
    },
    async createProfile(profile) {
      await client.insert("employee_profiles", toDbProfile(profile));
    },
    async updateProfile(profile) {
      try {
        const row = await client.rpc("update_admin_profile", {
          p_profile_id: profile.id,
          p_employee_code: profile.employeeId,
          p_email: profile.email,
          p_full_name: profile.name,
          p_title: profile.title,
          p_seniority_level: profile.seniorityLevel || "mid",
          p_is_department_lead: profile.leadEligible === true,
          p_department_id: profile.departmentId || null,
          p_photo_url: profile.photoRef || profile.photo || null,
          p_yearly_vacation_days: profile.yearlyVacationDays,
          p_remaining_vacation_days: profile.remainingVacationDays,
          p_user_id: profile.userId || null
        });
        return row ? fromDbProfile(row) : null;
      } catch (error) {
        if (!/schema cache|Could not find the function|update_admin_profile/i.test(error.message || "")) throw error;
        await client.update("employee_profiles", `id=eq.${profile.id}`, toDbProfile(profile));
        return null;
      }
    },
    async updateOwnProfile(profile) {
      await client.rpc("update_own_profile", {
        p_profile_id: profile.id,
        p_full_name: profile.name,
        p_photo_url: profile.photoRef || profile.photo || null,
        p_title: profile.title
      });
    },
    async setProfileDepartments(profile) {
      try {
        await client.delete("employee_profile_departments", `profile_id=eq.${profile.id}`);
        const rows = (profile.departmentIds || []).map((departmentId) => ({
          profile_id: profile.id,
          department_id: departmentId
        }));
        if (rows.length) await client.insert("employee_profile_departments", rows);
      } catch (error) {
        if (!/schema cache|employee_profile_departments|Could not find the table/i.test(error.message || "")) throw error;
      }
    },
    async upsertUserRole(userRole) {
      await client.upsert("user_roles", toDbUserRole(userRole), "user_id");
    },
    async unlinkProfileAccount(profile) {
      if (profile.userId) await client.delete("user_roles", `user_id=eq.${profile.userId}`);
      await client.update("employee_profiles", `id=eq.${profile.id}`, { user_id: null });
    },
    async upsertDepartment(department) {
      await client.upsert("departments", toDbDepartment(department), "id");
    },
    async deleteDepartment(department) {
      await client.delete("departments", `id=eq.${department.id}`);
    },
    async upsertScheduleOverride(override) {
      await client.upsert("schedule_overrides", toDbOverride(override), "profile_id,shift_date");
    },
    async deleteScheduleOverride(override) {
      await client.delete("schedule_overrides", `profile_id=eq.${override.profileId}&shift_date=eq.${override.date}`);
    },
    async createVacationRequest(request) {
      await client.insert("vacation_requests", toDbVacationRequest(request));
    },
    async updateVacationDecision(request, profile, overrides) {
      await client.rpc("decide_vacation_request", { p_request_id: request.id, p_decision: request.status });
    },
    async upsertDailyLead(lead) {
      await client.upsert("department_daily_leads", toDbLead(lead), "department_id,lead_date");
    },
    async deleteDailyLead(lead) {
      await client.delete("department_daily_leads", `department_id=eq.${lead.departmentId}&lead_date=eq.${lead.date}`);
    },
    async upsertDepartmentLeadRotation(rotation) {
      await client.upsert("department_lead_rotation_versions", toDbLeadRotation(rotation), "department_id,effective_start");
    },
    async upsertRotation(rotation) {
      await client.upsert("rotation_versions", toDbRotation(rotation), "id");
    },
    async saveDepartmentRotations(departmentId, effectiveStart, patterns) {
      const rows = await client.rpc("save_department_rotation_versions", {
        p_department_id: departmentId,
        p_effective_start: effectiveStart,
        p_patterns_json: patterns
      });
      return rows.map(fromDbRotation);
    },
    async upsertStatus(status) {
      await client.upsert("shift_statuses", toDbStatus(status), "id");
    },
    async uploadProfilePhoto(profileId, file) {
      const extension = photoExtension(file.type);
      const path = `${profileId}/${crypto.randomUUID()}.${extension}`;
      await client.uploadObject("profile-photos", path, file);
      try {
        const url = await client.signObject("profile-photos", path, 3600);
        return { reference: `${profilePhotoPrefix}${path}`, url };
      } catch (error) {
        await client.deleteObject("profile-photos", path).catch(() => {});
        throw error;
      }
    },
    async deleteProfilePhoto(reference) {
      const path = storagePhotoPath(reference);
      if (path) await client.deleteObject("profile-photos", path);
    },
    async insertAudit(entry) {
      await client.insert("audit_log", toDbAudit(entry));
    }
  };
}

function createRestClient() {
  const sessionKey = "sport360-supabase-session";
  const baseUrl = supabaseConfig.url.replace(/\/$/, "");

  function getSession() {
    const stored = localStorage.getItem(sessionKey);
    return stored ? JSON.parse(stored) : null;
  }

  async function request(path, options = {}) {
    await refreshIfNeeded(path);
    const session = getSession();
    const headers = {
      apikey: supabaseConfig.anonKey,
      "Content-Type": "application/json",
      ...options.headers
    };
    headers.Authorization = `Bearer ${session?.access_token || supabaseConfig.anonKey}`;

    try {
      return await fetchJson(path, options, headers);
    } catch (error) {
      if (error?.message === "Failed to fetch") {
        throw new Error("Failed to reach Supabase. Check that this browser can access your Supabase project and that no browser shield/ad blocker is blocking the request.");
      }
      throw error;
    }
  }

  async function fetchJson(path, options, headers, retrying = false) {
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = body?.msg || body?.message || body?.error_description || body?.hint || `Supabase request failed (${response.status})`;
      if (!retrying && response.status === 401 && /jwt expired/i.test(message)) {
        await refreshSession();
        const session = getSession();
        return fetchJson(path, options, { ...headers, Authorization: `Bearer ${session?.access_token || supabaseConfig.anonKey}` }, true);
      }
      if (response.status === 401) {
        clearStoredSession();
      }
      throw new Error(message);
    }
    return body;
  }

  async function refreshIfNeeded(path) {
    if (path.includes("/auth/v1/token") || path.includes("/auth/v1/signup")) return;
    const session = getSession();
    if (!session?.refresh_token || !session.expires_at) return;
    if (Date.now() < session.expires_at - 60000) return;
    await refreshSession();
  }

  async function refreshSession() {
    const session = getSession();
    if (!session?.refresh_token) {
      clearStoredSession();
      throw new Error("Session expired. Please sign in again.");
    }

    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      clearStoredSession();
      throw new Error(body?.msg || body?.message || body?.error_description || "Session expired. Please sign in again.");
    }
    storeSession(body);
  }

  function storeSession(data) {
    const user = data.user || data.session?.user;
    const accessToken = data.access_token || data.session?.access_token;
    const refreshToken = data.refresh_token || data.session?.refresh_token;
    const expiresIn = data.expires_in || data.session?.expires_in || 3600;
    if (!accessToken) return;
    localStorage.setItem(sessionKey, JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + expiresIn * 1000,
      user
    }));
  }

  function clearStoredSession() {
    localStorage.removeItem(sessionKey);
  }

  return {
    getSession,
    setSession(data) {
      storeSession(data);
    },
    clearSession() {
      clearStoredSession();
    },
    async signIn(email, password) {
      return request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    },
    async signUp(email, password) {
      return request("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    },
    async rpc(name, payload = {}) {
      return request(`/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
    },
    async select(table, orderColumn, ascending = true) {
      const direction = ascending ? "asc" : "desc";
      return request(`/rest/v1/${table}?select=*&order=${orderColumn}.${direction}`, {
        headers: { Accept: "application/json" }
      });
    },
    async insert(table, payload) {
      return request(`/rest/v1/${table}`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload)
      });
    },
    async upsert(table, payload, onConflict) {
      return request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload)
      });
    },
    async update(table, filter, payload) {
      return request(`/rest/v1/${table}?${filter}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload)
      });
    },
    async delete(table, filter) {
      return request(`/rest/v1/${table}?${filter}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
    },
    async uploadObject(bucket, objectPath, file) {
      return request(`/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`, {
        method: "POST",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file
      });
    },
    async signObject(bucket, objectPath, expiresIn) {
      const result = await request(`/storage/v1/object/sign/${bucket}/${encodeObjectPath(objectPath)}`, {
        method: "POST",
        body: JSON.stringify({ expiresIn })
      });
      const signedPath = result?.signedURL || result?.signedUrl || result?.signed_url;
      if (!signedPath) throw new Error("Supabase did not return a signed photo URL.");
      if (signedPath.startsWith("http")) return signedPath;
      if (signedPath.startsWith("/storage/v1/")) return `${baseUrl}${signedPath}`;
      return `${baseUrl}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
    },
    async deleteObject(bucket, objectPath) {
      return request(`/storage/v1/object/${bucket}`, {
        method: "DELETE",
        body: JSON.stringify({ prefixes: [objectPath] })
      });
    }
  };
}

function encodeObjectPath(objectPath) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function photoExtension(contentType) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[contentType] || "jpg";
}

function storagePhotoPath(reference = "") {
  return reference.startsWith(profilePhotoPrefix) ? reference.slice(profilePhotoPrefix.length) : "";
}

function emptyState() {
  return {
    currentUserId: null,
    users: [],
    departments: [],
    profiles: [],
    statuses: [],
    rotationVersions: [],
    scheduleOverrides: [],
    departmentLeads: [],
    departmentLeadRotations: [],
    vacationRequests: [],
    userRoles: [],
    auditLog: []
  };
}

async function loadRemoteState(client, session) {
  const [departments, profiles, profileDepartments, statuses, rotations, overrides, leads, leadRotations, requests, roles] = await Promise.all([
    client.select("departments", "created_at"),
    client.select("employee_profiles", "full_name"),
    safeSelect(client, "employee_profile_departments", "profile_id"),
    client.select("shift_statuses", "sort_order"),
    client.select("rotation_versions", "effective_start"),
    client.select("schedule_overrides", "shift_date"),
    client.select("department_daily_leads", "lead_date"),
    safeSelect(client, "department_lead_rotation_versions", "effective_start"),
    client.select("vacation_requests", "requested_at", false),
    client.select("user_roles", "created_at")
  ]);

  const mappedProfiles = await Promise.all(profiles.map(async (row) => {
    const profile = fromDbProfile(row);
    profile.departmentIds = [
      profile.departmentId,
      ...profileDepartments.filter((membership) => membership.profile_id === profile.id).map((membership) => membership.department_id)
    ].filter((departmentId, index, values) => departmentId && values.indexOf(departmentId) === index);
    const photoPath = storagePhotoPath(profile.photoRef);
    if (photoPath) {
      try {
        profile.photo = await client.signObject("profile-photos", photoPath, 3600);
      } catch {
        profile.photo = "";
      }
    }
    return profile;
  }));
  const currentProfile = mappedProfiles.find((profile) => profile.userId === session.user.id);
  const currentRole = roles.find((role) => role.user_id === session.user.id);
  const auditLog = currentRole?.role === "admin" ? await safeAuditLoad(client) : [];

  return {
    currentUserId: session.user.id,
    users: [{ id: session.user.id, email: session.user.email, role: currentRole?.role || "employee", profileId: currentProfile?.id }],
    departments: departments.map(fromDbDepartment),
    userRoles: roles.map(fromDbUserRole),
    profiles: mappedProfiles,
    statuses: statuses.map(fromDbStatus),
    rotationVersions: rotations.map(fromDbRotation),
    scheduleOverrides: overrides.map(fromDbOverride),
    departmentLeads: leads.map(fromDbLead),
    departmentLeadRotations: leadRotations.map(fromDbLeadRotation),
    vacationRequests: requests.map(fromDbVacationRequest),
    auditLog
  };
}

async function safeAuditLoad(client) {
  try {
    const rows = await client.select("audit_log", "created_at", false);
    return rows.map(fromDbAudit);
  } catch {
    return [];
  }
}

async function safeSelect(client, table, orderColumn, ascending = true) {
  try {
    return await client.select(table, orderColumn, ascending);
  } catch {
    return [];
  }
}

async function claimProfileForSession(client, session) {
  if (!session?.user?.email) return;
  await client.rpc("claim_profile_for_current_user");
}

function fromDbDepartment(row) {
  return { id: row.id, name: row.name, coverageTarget: row.min_available_people ?? 1 };
}

function toDbDepartment(department) {
  return {
    id: department.id,
    name: department.name,
    min_available_people: department.coverageTarget ?? 1
  };
}

function fromDbProfile(row) {
  const photoRef = row.photo_url || "";
  return {
    id: row.id,
    employeeId: row.employee_code,
    email: row.email,
    name: row.full_name,
    title: row.title,
    seniorityLevel: row.seniority_level || "mid",
    leadEligible: row.is_department_lead === true,
    departmentId: row.department_id,
    departmentIds: row.department_id ? [row.department_id] : [],
    photo: storagePhotoPath(photoRef) ? "" : photoRef,
    photoRef,
    yearlyVacationDays: row.yearly_vacation_days,
    remainingVacationDays: row.remaining_vacation_days,
    userId: row.user_id
  };
}

function toDbProfile(profile) {
  return {
    id: profile.id,
    employee_code: profile.employeeId,
    email: profile.email,
    full_name: profile.name,
    title: profile.title,
    seniority_level: profile.seniorityLevel || "mid",
    is_department_lead: profile.leadEligible === true,
    department_id: profile.departmentId || null,
    photo_url: profile.photoRef || profile.photo || null,
    yearly_vacation_days: profile.yearlyVacationDays,
    remaining_vacation_days: profile.remainingVacationDays,
    user_id: profile.userId
  };
}

function fromDbUserRole(row) {
  return { userId: row.user_id, role: row.role };
}

function toDbUserRole(userRole) {
  return { user_id: userRole.userId, role: userRole.role };
}

function fromDbStatus(row) {
  return { id: row.id, label: row.label, color: row.color, kind: row.kind };
}

function toDbStatus(status) {
  return { id: status.id, label: status.label, color: status.color || "#991b1b", kind: status.kind };
}

function fromDbRotation(row) {
  return { id: row.id, profileId: row.profile_id, effectiveStart: row.effective_start, pattern: row.pattern };
}

function toDbRotation(rotation) {
  return { id: rotation.id, profile_id: rotation.profileId, effective_start: rotation.effectiveStart, pattern: rotation.pattern };
}

function fromDbOverride(row) {
  return { id: row.id, profileId: row.profile_id, date: row.shift_date, statusId: row.status_id, note: row.note || "" };
}

function toDbOverride(override) {
  return { id: override.id, profile_id: override.profileId, shift_date: override.date, status_id: override.statusId, note: override.note || null };
}

function fromDbLead(row) {
  return { id: row.id, departmentId: row.department_id, date: row.lead_date, profileId: row.lead_profile_id };
}

function toDbLead(lead) {
  return { id: lead.id, department_id: lead.departmentId, lead_date: lead.date, lead_profile_id: lead.profileId };
}

function fromDbLeadRotation(row) {
  return {
    id: row.id,
    departmentId: row.department_id,
    effectiveStart: row.effective_start,
    pattern: Array.isArray(row.pattern) ? row.pattern : []
  };
}

function toDbLeadRotation(rotation) {
  return {
    id: rotation.id,
    department_id: rotation.departmentId,
    effective_start: rotation.effectiveStart,
    pattern: rotation.pattern
  };
}

function fromDbVacationRequest(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason || "",
    status: row.status,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    deductedDays: row.deducted_days
  };
}

function toDbVacationRequest(request) {
  return {
    id: request.id,
    profile_id: request.profileId,
    start_date: request.startDate,
    end_date: request.endDate,
    reason: request.reason || null,
    status: request.status,
    requested_at: request.requestedAt,
    decided_by: request.decidedBy,
    decided_at: request.decidedAt,
    deducted_days: request.deductedDays
  };
}

function toDbVacationDecision(request) {
  return {
    status: request.status,
    decided_by: request.decidedBy,
    decided_at: request.decidedAt,
    deducted_days: request.deductedDays
  };
}

function toDbAudit(entry) {
  return {
    id: entry.id,
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    detail: { message: entry.detail },
    created_at: entry.createdAt
  };
}

function fromDbAudit(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    detail: row.detail?.message || "",
    createdAt: row.created_at
  };
}
