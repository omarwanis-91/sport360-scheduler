export function byId(collection = [], id) {
  return collection.find((item) => item.id === id);
}

export function parseDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso, amount) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + amount);
  return toIso(date);
}

export function dateDiff(startIso, endIso) {
  return Math.round((parseDate(endIso) - parseDate(startIso)) / 86400000);
}

export function weekdayIndex(iso) {
  const jsDay = parseDate(iso).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function datesBetween(startIso, endIso) {
  const days = Math.max(0, dateDiff(startIso, endIso));
  return Array.from({ length: days + 1 }, (_, index) => addDays(startIso, index));
}

export function normalizeWeekPattern(pattern, defaultWeekPattern) {
  if (pattern?.length === 7) return [...pattern];
  return Array.from({ length: 7 }, (_, index) => pattern?.[index % pattern.length] || defaultWeekPattern[index]);
}

export function sanitizeRotationPattern(pattern, rotationStatusIds, defaultWeekPattern, fallback = "weekend") {
  return normalizeWeekPattern(pattern, defaultWeekPattern).map((statusId) => rotationStatusIds.includes(statusId) ? statusId : fallback);
}

export function roleForProfile(state, profile) {
  if (!profile?.userId) return "unclaimed";
  return state.userRoles?.find((role) => role.userId === profile.userId)?.role
    || state.users?.find((user) => user.id === profile.userId)?.role
    || "employee";
}

export function activeRotation(rotationVersions, profileId, dateIso) {
  return rotationVersions
    .filter((rotation) => rotation.profileId === profileId && rotation.effectiveStart <= dateIso)
    .sort((a, b) => b.effectiveStart.localeCompare(a.effectiveStart))[0];
}

export function latestRotationForProfile(rotationVersions, profileId) {
  return rotationVersions
    .filter((rotation) => rotation.profileId === profileId)
    .sort((a, b) => b.effectiveStart.localeCompare(a.effectiveStart))[0];
}

export function activeLeadRotation(leadRotations, departmentId, dateIso) {
  return leadRotations
    .filter((rotation) => rotation.departmentId === departmentId && rotation.effectiveStart <= dateIso)
    .sort((a, b) => b.effectiveStart.localeCompare(a.effectiveStart))[0];
}

export function departmentLeadForDate(state, departmentId, dateIso) {
  const validProfile = (profileId) => {
    const profile = byId(state.profiles, profileId);
    return profile?.departmentId === departmentId && profile.leadEligible ? profile : null;
  };
  const override = state.departmentLeads.find((item) => item.departmentId === departmentId && item.date === dateIso);
  const overrideProfile = validProfile(override?.profileId);
  if (override && overrideProfile) return { profile: overrideProfile, source: "Daily override", override };

  const rotation = activeLeadRotation(state.departmentLeadRotations || [], departmentId, dateIso);
  const profile = validProfile(rotation?.pattern?.[weekdayIndex(dateIso)]);
  return { profile, source: rotation && profile ? "Lead rotation" : "Unassigned", rotation };
}

export function scheduleFor(state, profileId, dateIso) {
  const override = state.scheduleOverrides.find((entry) => entry.profileId === profileId && entry.date === dateIso);
  const rotation = activeRotation(state.rotationVersions, profileId, dateIso);
  const rotationStatus = rotation ? byId(state.statuses, rotation.pattern.length === 7
    ? rotation.pattern[weekdayIndex(dateIso)]
    : rotation.pattern[Math.max(0, dateDiff(rotation.effectiveStart, dateIso)) % rotation.pattern.length]) : null;

  if (override) {
    return {
      ...byId(state.statuses, override.statusId),
      source: "Override",
      note: override.note,
      override,
      rotation,
      rotationStatus
    };
  }

  if (!rotation) return { id: "empty", label: "Unassigned", color: "#3f3f46", kind: "off", source: "No rotation" };

  return { ...rotationStatus, source: "Rotation", rotation, rotationStatus };
}

export function workdayCount(state, profileId, startIso, endIso) {
  const days = dateDiff(startIso, endIso) + 1;
  return Array.from({ length: days }, (_, index) => addDays(startIso, index))
    .filter((date) => scheduleFor(state, profileId, date).kind === "working").length;
}
