# Project TODO

This file tracks current priorities. Reorder and update it as work progresses. Completed items should move to the completed section rather than disappearing immediately.

## Now

- [ ] Perform a short application UI regression pass with Admin, Department Lead, and Employee accounts.

## Next

- [ ] Improve department-wide rotation editing so multiple people can be reviewed and changed together.
- [ ] Add stronger loading, empty, error, and retry states around Supabase operations.
- [ ] Move profile photos to a verified Supabase Storage workflow instead of database-heavy image data.
- [ ] Add vacation cancellation and clearer rejection notes/history.
- [ ] Improve responsive behavior for narrower laptop and mobile widths.
- [ ] Make Activity search update as the user types and add employee/date filtering.
- [ ] Add automated tests for schedule resolution, rotations, overrides, and vacation deduction.

## Later

- [ ] Extract stable domains from `src/main.js` into focused modules.
- [ ] Split `src/styles.css` by stable UI/domain boundaries.
- [ ] Add deployment-ready environment configuration.
- [ ] Add production deployment documentation and health checks.
- [ ] Add notification support for request decisions and important schedule changes.
- [ ] Consider multi-cell selection, drag-to-fill, and copy-week scheduler tools.
- [ ] Consider splitting this decision log into individual ADR files once it becomes difficult to scan.

## Recently Completed

- [x] Added full personal and employee profile calendar views.
- [x] Added four People views.
- [x] Improved department membership assignment and removal.
- [x] Separated rotational shifts from daily exceptions.
- [x] Added user-created rotation presets.
- [x] Improved the daily schedule editor with live coverage preview.
- [x] Improved vacation approval balance and coverage impact visibility.
- [x] Improved Activity filtering and visual differentiation.
- [x] Connected the local project to GitHub through a safe review branch and draft PR.
- [x] Added living repository documentation and Codex agent instructions.
- [x] Added a dependency-free production build and hosting configuration.
- [x] Reconciled the live Supabase schema and applied claimed-user security hardening.
- [x] Completed Supabase read-policy tests for Admin, Lead, Employee, and unmatched accounts.
- [x] Completed 17 rollback-safe Supabase write-policy checks with no failures.
