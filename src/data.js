import { emptyScheduleData } from "./config.js";
import { supabase } from "./supabaseClient.js";
import { datesInRange } from "./schedule.js";

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
    unwrap(client.from("departments").select("*").eq("active", true).order("display_order")),
    unwrap(client.from("shift_types").select("*").eq("active", true).order("display_order")),
    unwrap(client.from("people").select("*").eq("active", true).order("display_order")),
    unwrap(client.from("person_defaults").select("*")),
    unwrap(client.from("schedule_overrides").select("*")),
    unwrap(client.from("manager_defaults").select("*")),
    unwrap(client.from("manager_overrides").select("*")),
    unwrap(client.from("time_off_requests").select("*").order("created_at", { ascending: false })),
    unwrap(client.from("profiles").select("*").order("email"))
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
  const person = await unwrap(requireClient()
    .from("people")
    .insert({
      name: input.name,
      title: input.title || "Team Member",
      department_id: input.departmentId,
      vacation_limit: input.vacationLimit,
      display_order: input.displayOrder
    })
    .select()
    .single());

  await unwrap(requireClient()
    .from("person_defaults")
    .insert(Array.from({ length: 7 }, (_, weekday) => ({
      person_id: person.id,
      weekday,
      shift_type_id: weekday === 5 || weekday === 6 ? "weekend" : defaultShiftId
    }))));

  return person;
}

export async function updatePerson(personId, patch) {
  return unwrap(requireClient()
    .from("people")
    .update(patch)
    .eq("id", personId)
    .select()
    .single());
}

export async function deactivatePerson(personId) {
  return updatePerson(personId, { active: false });
}

export async function updatePersonOrder(updates) {
  return unwrap(requireClient()
    .from("people")
    .upsert(updates.map(({ id, display_order }) => ({ id, display_order }))));
}

export async function upsertDefault(personId, weekday, shiftTypeId) {
  return unwrap(requireClient()
    .from("person_defaults")
    .upsert({ person_id: personId, weekday, shift_type_id: shiftTypeId }, { onConflict: "person_id,weekday" }));
}

export async function upsertOverride(personId, shiftDate, shiftTypeId) {
  return unwrap(requireClient()
    .from("schedule_overrides")
    .upsert({
      person_id: personId,
      shift_date: shiftDate,
      shift_type_id: shiftTypeId,
      source: "admin"
    }, { onConflict: "person_id,shift_date" }));
}

export async function deleteOverride(personId, shiftDate) {
  return unwrap(requireClient()
    .from("schedule_overrides")
    .delete()
    .eq("person_id", personId)
    .eq("shift_date", shiftDate));
}

export async function clearDay(shiftDate) {
  const client = requireClient();
  await Promise.all([
    unwrap(client.from("schedule_overrides").delete().eq("shift_date", shiftDate)),
    unwrap(client.from("manager_overrides").delete().eq("manager_date", shiftDate))
  ]);
}

export async function upsertManagerDefault(departmentId, weekday, personId) {
  return unwrap(requireClient()
    .from("manager_defaults")
    .upsert({ department_id: departmentId, weekday, person_id: personId || null }, { onConflict: "department_id,weekday" }));
}

export async function upsertManagerOverride(departmentId, managerDate, personId) {
  return unwrap(requireClient()
    .from("manager_overrides")
    .upsert({
      department_id: departmentId,
      manager_date: managerDate,
      person_id: personId || null
    }, { onConflict: "department_id,manager_date" }));
}

export async function submitRequest(input) {
  return unwrap(requireClient()
    .from("time_off_requests")
    .insert(input)
    .select()
    .single());
}

export async function reviewRequest(request, status, adminNote, reviewerId, shiftTypeId) {
  const client = requireClient();
  const reviewedAt = new Date().toISOString();

  if (status === "approved") {
    await unwrap(client
      .from("schedule_overrides")
      .upsert(datesInRange(request.start_date, request.end_date).map((shiftDate) => ({
        person_id: request.person_id,
        shift_date: shiftDate,
        shift_type_id: shiftTypeId,
        source: "request",
        request_id: request.id,
        created_by: reviewerId
      })), { onConflict: "person_id,shift_date" }));
  }

  return unwrap(client
    .from("time_off_requests")
    .update({
      status,
      admin_note: adminNote || "",
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt
    })
    .eq("id", request.id)
    .select()
    .single());
}

export async function linkProfile(profileId, personId, role) {
  return unwrap(requireClient()
    .from("profiles")
    .update({ person_id: personId || null, role })
    .eq("id", profileId)
    .select()
    .single());
}
