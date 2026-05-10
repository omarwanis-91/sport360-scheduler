export function isAdmin(profile) {
  return profile?.role === "admin";
}

export function canEditSchedule(profile) {
  return isAdmin(profile);
}

export function canManagePeople(profile) {
  return isAdmin(profile);
}

export function canReviewRequests(profile) {
  return isAdmin(profile);
}

export function canExportCsv(profile) {
  return isAdmin(profile);
}

export function canSubmitRequests(profile) {
  return Boolean(profile?.person_id);
}
