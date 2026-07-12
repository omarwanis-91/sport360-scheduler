# Sport360 Scheduler Roadmap

This document is the durable phased plan for Sport360 Scheduler. It records what has been completed, the current project position, the acceptance gate for each phase, and the intended path to production. `docs/TODO.md` remains the short actionable queue.

## Current Position

Phases 0-3 are complete. The project is in Phase 4: Production-Ready Internal Release. The immediate working step is to put an internal online preview live through the connected static host while keeping the full backup/restore gate open. Phases 5-6 remain intentionally non-blocking for the first production release.

## Phase 0 - Product Foundation

**Status:** Complete

### Scope

- Define the department-based scheduler vision, roles, statuses, and dark compact design direction.
- Establish the vanilla JavaScript architecture and Supabase-backed data model.
- Separate recurring rotations from date-specific schedule exceptions.
- Preserve historical schedules through effective-dated rotation versions.

### Completion Gate

- Product vision is documented in `docs/VISION.md`.
- Technical and visual foundations are documented in `docs/ARCHITECTURE.md`.
- Foundational product and technical choices are documented in `docs/DECISIONS.md`.

## Phase 1 - Core Scheduling Product

**Status:** Complete

### Scope

- Deliver the scheduler grid, coverage indicators, weekly rotations, rotation versioning, and daily overrides.
- Deliver vacation requests, approval impact, balance deduction, and resulting schedule updates.
- Deliver People, Departments, profile calendars, Activity, Settings, and role-aware navigation.

### Completion Gate

- Core scheduling and people workflows operate locally and against Supabase.
- Role-aware application navigation and primary Admin, Lead, and Employee workflows are available.

## Phase 2 - Security, Delivery, and Project Continuity

**Status:** Complete

### Scope

- Connect GitHub, focused branches, pull requests, Netlify previews, and static deployment builds.
- Add living project documentation and repository-specific agent instructions.
- Reconcile Supabase migrations and harden claimed-profile access.
- Verify schema, RLS, RPCs, Admin/Lead/Employee reads, write policies, and browser role boundaries.

### Completion Gate

- Schema and security audits pass.
- Admin, Lead, Employee, and unmatched-account read boundaries pass.
- All 17 rollback-safe write-policy checks pass.
- Browser permission regression checks pass for all application roles.
- `main` is synchronized with the reviewed live project state.

## Phase 3 - Department Rotation Operations

**Status:** Complete

### Scope

- ✅ Add department-wide edit mode to the existing rotation board.
- ✅ Support selecting multiple people, applying saved presets, editing all seven weekday slots, and choosing one effective date.
- ✅ Keep the individual rotation drawer for focused edits.
- ✅ Save all changed profiles atomically through an authorized Supabase RPC:
  `save_department_rotation_versions(department_id, effective_start, patterns_json)`.
- ✅ Preserve history by always creating new effective-dated rotation versions.
- ✅ Permit only Morning, Mid-day, Night, and Weekend in rotation patterns.

### Acceptance Gate

- Admin and Lead can select multiple people, preview their changes, and save them together.
- A successful save creates the expected new rotation versions without rewriting prior history.
- Invalid rotation statuses are rejected.
- A failure for any selected profile leaves the entire operation unapplied.
- Leads cannot edit another department or create prohibited past-dated versions.
- The individual rotation workflow remains functional.

## Phase 4 - Production-Ready Internal Release

**Status:** Current

Feature development freezes after Phase 3 while this production hardening phase is completed.

### Scope

- ✅ Replace committed environment details with generated runtime configuration:
  `window.__SPORT360_CONFIG__ = { supabaseUrl, supabaseAnonKey, allowSignup, release }`.
- ✅ Generate production configuration from Netlify environment variables and local configuration from ignored `.env.local`.
- ✅ Use Admin-created or invited accounts and hide public account creation when `allowSignup` is false.
- ✅ Store new profile photos in a private Supabase Storage bucket named `profile-photos`, with a legacy image fallback until old images are replaced.
- ✅ Add consistent loading, disabled, success, retry, offline, and failure states to every Supabase mutation.
- ✅ Extract pure schedule and permission logic sufficiently to support automated Node tests.
- ✅ Add GitHub Actions for static checks, unit tests, the production build, and demo-mode Chromium smoke tests.
- ✅ Support current Chrome and Edge at 1024px, 1280px, 1440px, and 1920px widths. Mobile remains best-effort.
- ⏳ Deploy the reviewed app online for internal preview through the connected static host.
- ⏳ Verify production auth redirects, backup/export procedure, migration log, audit retention, health checks, and rollback instructions.
- ⏳ Repair or bypass the local Docker/WSL blocker so the Supabase Free-plan SQL export can be completed and restored in a test project.
- ⬜ Pilot the production release with one department for five business days before expanding internally.

### Acceptance Gate

- No open critical or high-severity defects remain.
- GitHub Actions checks, unit tests, build, smoke tests, and live role audits pass.
- Storage policies and Admin-created/invitation onboarding are verified in production.
- Error recovery and supported viewport checks pass.
- A current production backup exists and a restore rehearsal has succeeded.
- Monitoring and rollback procedures are confirmed.
- The pilot department signs off after five business days of monitored use.

## Phase 5 - Post-Production Product Expansion

**Status:** Future

### Scope

- Add vacation cancellation, rejection comments, and richer request history.
- Add Activity live search and employee, department, date, and action filters.
- Add notifications for request decisions and important schedule changes.
- Add advanced scheduler tools: multi-cell selection, drag-to-fill, copy week, and bulk clear.
- Complete mobile-specific workflows if mobile becomes a supported target.

### Acceptance Gate

- Priorities are validated against production usage and agreed before implementation.
- Each selected workflow has role, failure-state, and regression coverage before release.

## Phase 6 - Scale and Maintainability

**Status:** Future

### Scope

- Split `src/main.js` into stable scheduling, people, requests, permissions, and UI modules.
- Split CSS by stable domain and shared component boundaries.
- Add migration automation, broader integration tests, accessibility checks, performance budgets, and structured observability.
- Split the decision log into individual architecture decision records when the single file becomes difficult to scan.

### Acceptance Gate

- Module boundaries reduce change risk without altering established behavior.
- Automated migration, integration, accessibility, and performance checks run in CI.
- Production diagnostics provide enough structured information to investigate failures.

## Roadmap Maintenance

- Close a phase only after its acceptance gate is completed and recorded here.
- Keep `docs/TODO.md` focused on current and immediately upcoming work.
- Move completed tactical work from `docs/TODO.md` into the relevant phase history rather than allowing it to disappear.
- Update `docs/DECISIONS.md` when scope, release gates, platform support, or technical direction changes.
- Later features do not block the Phase 4 internal production release unless production evidence shows they are required.
