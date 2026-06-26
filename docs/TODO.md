# Project TODO

This file tracks current priorities. Reorder and update it as work progresses. Completed items should move to the completed section rather than disappearing immediately.

## Now

- [x] Replace committed environment details with generated runtime configuration.
- [x] Generate production configuration from Netlify variables and ignored local configuration.
- [x] Disable public signup in production and verify Admin-created onboarding.
- [x] Add GitHub Actions Chromium smoke tests for demo-mode browser coverage.
- [~] Verify Chrome/Edge layouts at all supported desktop widths.

## Next

- [ ] Document and rehearse production backup, restore, health check, monitoring, and rollback.
- [ ] Pilot one department for five business days and record signoff.

## Later

- [ ] Phase 5: add vacation cancellation, rejection comments, and richer request history.
- [ ] Phase 5: add Activity live search and employee, department, date, and action filters.
- [ ] Phase 5: add notifications and advanced scheduler bulk tools.
- [ ] Phase 5: complete mobile workflows if mobile becomes a supported target.
- [ ] Phase 6: extract stable domains from `src/main.js` and split CSS by stable boundaries.
- [ ] Phase 6: add migration automation, broader integration, accessibility, performance, and observability checks.
- [ ] Phase 6: split decisions into individual ADR files when the current log becomes difficult to scan.

## Recently Completed

- [x] Added an authorized Admin profile update RPC so seniority and department lead fields persist in live Supabase.
- [x] Made the Hierarchy view department-scoped with primary-only/all-departments modes and labeled today directly on Scheduler date headers.
- [x] Added primary/additional department memberships, self-service title updates, and the hierarchy workspace.
- [x] Added profile seniority, department-lead eligibility, weekly lead rotations, and Scheduler daily lead overrides.
- [x] Added consistent mutation loading, disabled, success, retry, offline, and failure states.
- [x] Extracted pure schedule logic and added Node unit tests plus GitHub Actions syntax/test/build checks.
- [x] Added a production-build Chromium smoke test covering app load and primary navigation.
- [x] Moved new profile photos to private Supabase Storage with legacy fallback.
- [x] Completed department-wide rotation editing with multi-person selection and shared weekly patterns.
- [x] Added and verified atomic, history-preserving batch rotation saves for Admin and Department Leads.
- [x] Passed all eight department rotation history, validation, atomicity, and role-boundary audit checks.
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
- [x] Completed browser UI regression for Admin, Department Lead, and Employee permission boundaries.
