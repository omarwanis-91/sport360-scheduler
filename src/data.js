import { emptyScheduleData } from "./config.js";
import { supabase } from "./supabaseClient.js";

function requireClient() {
  if (!supabase) throw new Error("Missing Supabase configuration.");
  return supabase;
}

async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  const client = requireClient();
  return client.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signIn(email) {
  const client = requireClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) throw error;
}

export async function signOut() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function loadProfile(userId) {
  return unwrap(requireClient()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single());
}

export async function loadScheduleData() {
  const client = requireClient();
  const noCache = { head: false };
  const [
    departments,
    shiftTypes,
    people,
    defaults,
    overrides,
    managerDefaults,
    managerOverrides,
    requests,
    profiles
  ] = await Promise.all([
    unwrap(client.from("departments").select("*", noCache).eq("active", true).order("display_order")),
    unwrap(client.from("shift_types").select("*", noCache).eq("active", true).order("display_order")),
    unwrap(client.from("people").select("*", noCache).eq("active", true).order("display_order")),
    unwrap(client.from("person_defaults").select("*", noCache)),
    unwrap(client.from("schedule_overrides").select("*", noCache)),
    unwrap(client.from("manager_defaults").select("*", noCache)),
    unwrap(client.from("manager_overrides").select("*", noCache)),
    unwrap(client.from("time_off_requests").select("*", noCache).order("created_at", { ascending: false })),
    unwrap(client.from("profiles").select("*", noCache).order("email"))
  ]);

  return {
    ...emptyScheduleData,
    departments,
    shiftTypes,
    people,
    defaults,
    overrides,
    managerDefaults,
    managerOverrides,
    requests,
    profiles
  };
}

export async function addPerson(input, defaultShiftId) {
  return unwrap(requireClient().rpc("admin_add_person", {
    p_name: input.name,
    p_title: input.title || "Team Member",
    p_department_id: input.departmentId,
    p_vacation_limit: input.vacationLimit,
    p_display_order: input.displayOrder,
    p_default_shift_type_id: defaultShiftId,
    p_email: input.email || null,
    p_picture_url: input.pictureUrl || null
  }));
}

export async function updatePerson(personId, patch) {
  return unwrap(requireClient().rpc("admin_update_person", {
    p_person_id: personId,
    p_name: Object.hasOwn(patch, "name") ? patch.name : null,
    p_title: Object.hasOwn(patch, "title") ? patch.title : null,
    p_department_id: Object.hasOwn(patch, "department_id") ? patch.department_id : null,
    p_vacation_limit: Object.hasOwn(patch, "vacation_limit") ? patch.vacation_limit : null,
    p_active: Object.hasOwn(patch, "active") ? patch.active : null,
    p_email: Object.hasOwn(patch, "email") ? patch.email : null,
    p_picture_url: Object.hasOwn(patch, "picture_url") ? patch.picture_url : null
  }));
}

export async function deactivatePerson(personId) {
  return updatePerson(personId, { active: false });
}

export async function updatePersonOrder(updates) {
  return unwrap(requireClient().rpc("admin_update_person_order", {
    p_updates: updates.map(({ id, display_order }) => ({ id, display_order }))
  }));
}

export async function upsertDefault(personId, weekday, shiftTypeId) {
  return unwrap(requireClient().rpc("admin_upsert_person_default", {
    p_person_id: personId,
    p_weekday: weekday,
    p_shift_type_id: shiftTypeId
  }));
}

export async function upsertOverride(personId, shiftDate, shiftTypeId) {
  return unwrap(requireClient().rpc("admin_upsert_schedule_override", {
    p_person_id: personId,
    p_shift_date: shiftDate,
    p_shift_type_id: shiftTypeId
  }));
}

export async function deleteOverride(personId, shiftDate) {
  return unwrap(requireClient().rpc("admin_delete_schedule_override", {
    p_person_id: personId,
    p_shift_date: shiftDate
  }));
}

export async function clearDay(shiftDate) {
  return unwrap(requireClient().rpc("admin_clear_day", {
    p_target_date: shiftDate
  }));
}

export async function upsertManagerDefault(departmentId, weekday, personId) {
  return unwrap(requireClient().rpc("admin_upsert_manager_default", {
    p_department_id: departmentId,
    p_weekday: weekday,
    p_person_id: personId || null
  }));
}

export async function upsertManagerOverride(departmentId, managerDate, personId) {
  return unwrap(requireClient().rpc("admin_upsert_manager_override", {
    p_department_id: departmentId,
    p_manager_date: managerDate,
    p_person_id: personId || null
  }));
}

export async function submitRequest(input) {
  return unwrap(requireClient()
    .from("time_off_requests")
    .insert(input)
    .select()
    .single());
}

export async function reviewRequest(request, status, adminNote, reviewerId, shiftTypeId) {
  return unwrap(requireClient().rpc("admin_review_time_off_request", {
    p_request_id: request.id,
    p_status: status,
    p_admin_note: adminNote || "",
    p_shift_type_id: shiftTypeId
  }));
}

export async function linkProfile(profileId, personId, role) {
  return unwrap(requireClient().rpc("admin_link_profile", {
    p_profile_id: profileId,
    p_person_id: personId || null,
    p_role: role
  }));
}
