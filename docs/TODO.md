# Project TODO

This file tracks current priorities. Reorder and update it as work progresses. Completed items should move to the completed section rather than disappearing immediately.

## Now

- [~] Put the reviewed app online for internal preview through the connected static host.
- [~] Keep the Phase 4 production gate open: full SQL export/restore is blocked by local Docker/WSL, with dashboard CSV export as the temporary preview-only backup path.
- [ ] Verify the online preview manually in Chrome and Edge: sign-in, hidden signup, Scheduler, People, Departments, Rotations, Requests, Activity, Settings, and role boundaries.

## Next

- [ ] Repair Docker/WSL or use another machine so `npm.cmd run backup:manual` can create a full Supabase SQL export.
- [ ] Restore the verified export into a non-production Supabase project.
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

- [x] Accepted online internal preview before the full production backup gate, while keeping production readiness blocked until export/restore is verified.
- [x] Recorded passing local verification, passing GitHub checks, and Netlify deploy-preview status in the production rehearsal report.
- [x] Added a one-command Phase 4 local verification runner for syntax, unit, build, and smoke checks.
- [x] Added a production rehearsal report template for recording export, restore, health-check, monitoring, and rollback results.
- [x] Added a manual backup folder verifier for Free-plan export completeness checks.
- [x] Added and verified a backup prerequisite check that works through the Supabase CLI `npx` fallback.
- [x] Added a Supabase Free-plan manual export helper and backup ignore rules.
- [x] Documented production backup/export, restore rehearsal, migration log, health check, monitoring, and rollback procedures.
- [x] Replace committed environment details with generated runtime configuration.
- [x] Generate production configuration from Netlify variables and ignored local configuration.
- [x] Disable public signup in production and verify Admin-created onboarding.
- [x] Add GitHub Actions Chromium smoke tests for demo-mode browser coverage.
- [x] Added and passed automated viewport smoke coverage for 1024px, 1280px, 1440px, and 1920px desktop widths.
- [x] Fixed Scheduler/Rotation hover states so cells glow in their own status color with a smoother gradual transition.
- [x] Removed heavy coverage drawer row lines and made Scheduler/Rotation non-working cells quiet by default with stronger hover and filter focus.
- [x] Cleaned up Scheduler department labels, restored full day details for covered dates, improved non-working hover visibility, and added shift/status filtering.
- [x] Made Scheduler vertical bars calmer and allowed any department member to be assigned as day lead.
- [x] Fixed focused lead assignment saving for the opened department/date and kept approved vacation days from being labeled as manual overrides.
- [x] Simplified schedule visuals around working/non-working base states and made missing-lead assignment a focused centered modal.
- [x] Made Sick red, strengthened On Ground, removed manual Vacation overrides, and added missing-lead alerts/replacement prompts.
- [x] Made Vacation blue with a subtle beach/water treatment and gave On Ground a distinct teal terrain treatment across profiles and Scheduler.
- [x] Reworked Departments into a focused team-style overview with compact department switching and visible member chips.
- [x] Improved Departments hierarchy display and added a Details view beside the tile view.
- [x] Added Scheduler month-title arrows, month-start snapping, removed New Profile from Scheduler, and introduced parent/sub-department structure.
- [x] Moved Scheduler controls into the month bar, added start-date picking, Monday week dividers, Rotation lead icons, and quieter unavailable cells.
- [x] Added a horizontal Scheduler month bar with left/right range arrows above the date headers.
- [x] Added Scheduler lead icons on shift cards, softer schedule colors, and explicit 1-week/2-week/1-month zoom controls.
- [x] Persisted Admin profile department memberships through one guarded Supabase RPC so multi-department edits survive refresh.
- [x] Added Admin-only profile deletion for setup-stage pseudo profiles.
- [x] Changed departments to equal memberships, removed Department Lead tags from hierarchy, and added multi-department hierarchy filters.
- [x] Added authorized Admin profile update and membership-table schema-cache fallbacks so profile edits persist in live Supabase.
- [x] Made the Hierarchy view department-scoped with primary-only/all-departments modes and labeled today directly on Scheduler date headers.
- [x] Added multi-department memberships, self-service title updates, and the hierarchy workspace.
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
