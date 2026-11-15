# Architecture

## Current Shape

Sport360 Scheduler is a desktop-first static web application built with vanilla JavaScript, HTML, and CSS. A small Node server serves local files. Supabase provides authentication, PostgreSQL data, RLS policies, and RPC functions.

There is no frontend framework or bundler. A dependency-free Node build copies the deployable static files into `dist/` for hosting.

## Main Files

| Path | Responsibility |
| --- | --- |
| `index.html` | Application shell and asset cache versions. |
| `src/main.js` | UI state, rendering, event binding, permissions, and workflows. |
| `src/styles.css` | Full visual system and responsive layout. |
| `src/supabaseStore.js` | Supabase REST/Auth client and persistence adapter. |
| `src/annualBalances.mjs` | Cairo year calculation, per-year approval preview, and isolated demo renewal/deductions. |
| `src/analyticsLogic.mjs` | Saved-schedule resolution using the Scheduler's pure helpers, scoped demo snapshots, aggregation, and safe CSV export. |
| `src/analyticsView.mjs` | Native SVG Analytics charts, exact-value inspection, accessible data tables, and dashboard layout. |
| `src/data.js` | Seed/demo state and initial domain data. |
| `src/config.js` | Supabase and application configuration. |
| `scripts/localServer.js` | Local static file server. |
| `scripts/build.js` | Creates the deployable `dist/` directory. |
| `scripts/freePlanBackup.js` | Runs the Supabase Free-plan manual export helper without storing database credentials. |
| `playwright.live.config.mjs` and `live/phase4-role-boundaries.spec.mjs` | Run credential-injected, read-only production role checks in Chrome, Edge, and Firefox without storing passwords in the repository. |
| `scripts/verifyFreePlanBackup.js` | Verifies a manual export folder has the expected files before restore rehearsal. |
| `scripts/phase4LocalVerify.js` | Runs local Phase 4 release checks: syntax, unit tests, build, and demo smoke tests. |
| `test/rotationRpc.integration.mjs` | Runs migrations 029–032 and audits 017–020 against isolated PostgreSQL using a temporary PGlite runtime; verifies authorization, atomic saves, effective-date review, explicit leads, date corrections, and resets without production access. |
| `test/annualRollover.integration.mjs` | Verifies migration 033, year-scoped approval/profile RPCs, history preservation, RLS, stale edits and atomic failures in isolated PostgreSQL. Actual Cron activation is checked by live audit 021. |
| `netlify.toml` | Netlify build, publish, and SPA fallback settings. |
| `vercel.json` | Vercel build, output, and SPA rewrite settings. |
| `supabase/migrations/` | Database schema, RLS, and RPC evolution. |
| `supabase/audit/` | Read-only SQL reports for comparing the live database with repository expectations. |
| `supabase/seed.sql` | Optional starter data. |
| `docs/PRODUCTION_REHEARSAL_REPORT.md` | Records Phase 4 backup, restore, health-check, monitoring, and rollback rehearsal results. |

## Runtime Flow

1. `src/main.js` initializes the data store.
2. `src/supabaseStore.js` uses Supabase when configured and available.
3. Authentication state determines whether the sign-in, self-service onboarding, or application shell is rendered.
4. In prelaunch mode, non-Admin accounts may submit only their name and optional photo to `profile_onboarding_submissions`. This table is separate from `employee_profiles`, so onboarding cannot grant operational access.
5. Admins review pending submissions in People, then explicitly link one to an existing unclaimed employee profile or create a new unassigned employee profile. Existing Admin accounts bypass the holding page and continue into the scheduler.
6. Application state is rendered into `#app` using template functions.
7. Event listeners call workflow functions and persistence methods.
8. Successful writes update Supabase and then refresh or persist local state.
9. Role Preview substitutes an effective role, existing linked profile, and department scope for frontend rendering. Admins choose an actual Lead or Employee in one department. Managers with Lead access choose an Employee and see only the teams they share. A persistent banner identifies the read-only preview. The central mutation wrapper blocks writes and Supabase keeps the original signed-in session.

## UI Structure

The application uses view-level render functions rather than routes. Primary views include:

- My Profile
- Scheduler
- Annual Requests
- Team, one integrated workspace for department context, hierarchy, and people management
- Rotations
- Activity
- Settings

Settings separates Schedule (Public Holidays and Shift Labels) from Role Preview. Preview mode is session-local. Migration 037's `get_scheduler_tools` RPC returns eligible linked Employee profiles and shared teams for Managers with Lead access. Production authorization remains enforced through Supabase RLS/RPCs.

Team uses one shared department selection, a foldable parent/child department navigation list, and separate Hierarchy/Directory tabs. The list follows stored parent relationships; it does not infer membership or grant access to ancestors or siblings. Selecting a hidden department through the top selector expands its visible ancestors. Directory retains its four existing display modes.

Authorized hierarchy cards can be dragged between Manager, Lead, and Artist rows or moved through their accessible level menu. Migration 035 hardens the existing `update_profile_hierarchy` RPC: Admin or Manager position with Lead access only, within managed teams. A hybrid person's position requires management of every assigned team. The server returns the canonical derived title after a move. Access roles and scheduled Lead shifts remain separate. Employees and read-only Role Preview have no move controls.

`src/profileStructure.mjs` defines leaf-team choices and the nine automatic Video Edit/Motion Graphics/hybrid title mappings for previews and demo mode. Production titles are materialized by migration 035 triggers using full database memberships, rather than recalculated from incomplete RLS-visible memberships. Video Unit and parent departments are nonassignable containers, retained by `departments.is_container`. A read-only preflight detects container-only people before migration; redundant parent memberships are removed only when a valid leaf assignment already exists. Operational schedule and leave records stay intact.

Profile creation uses the Admin-only atomic `create_admin_team_profile` RPC with an internal generated employee code. Existing Admin saves retain the migration 033 stale-balance guard. Manager edits use `save_managed_profile_structure`, locking actor and target, preserving unmanaged memberships, and returning canonical profile data plus visible team IDs and edit permissions. `get_profile_structure_permissions` tells the client when hidden hybrid memberships prohibit a global position change. Direct membership/profile writes remain constrained by existing Admin RLS and new container/title triggers. See `docs/TEAM_STRUCTURE.md` for activation and the access matrix.

The current setup starts scheduling from November 2026 and skips earlier history. Admin sets recurring Annual allowance and actual current remaining days independently in Edit Profile, without creating historical requests or daily overrides. `docs/BACKFILL.md` documents opening balances and retains optional historical-entry guidance. Migration 033 adds automatic Cairo calendar-year renewal and separate yearly balance records; deployment requires migration 033 and audit 021 first.

`annual_balance_years` preserves each profile/year's allowance and remainder. The existing profile fields mirror only the active year for compatibility with the compact UI. An hourly Supabase Cron job checks for a year change (including Cairo midnight on January 1); `refresh_annual_balances` catches up visible profiles before loading app data if a job was missed or the project was paused. Private helpers lock the profile before the year's row, renew once per year without carryover, preserve advance bookings, and record system audit entries. Missing intermediate years are retained when catching up. Browser callers cannot choose a rollover year or invoke the global reset/helper functions.

Annual approval snapshots eligible dates, splits deductions by calendar year in one transaction, stores `deducted_days_by_year` on the request, and changes only those yearly balances and date overrides. A December/January request therefore cannot charge the whole range against one year or regain booked days after renewal. Historical approvals in tracked years charge their own archived year; years before tracking require Admin review. Existing balances and approved requests remain unchanged on installation; identifiable legacy future Annual overrides reserve the actual future-year budget without silently refunding today's manually entered remainder.

Admin profile edits use `save_admin_profile_annual` with the displayed year and original allowance/remainder. The server rejects a stale form after a renewal or concurrent current-year deduction. Triggers synchronize the ledger, audit manual adjustments, block unsafe legacy balance writes, and keep future entitlements aligned with saved allowance changes without rewriting previous years. Opening-balance editing remains Admin-only. `src/annualBalances.mjs` mirrors renewal, per-year preview and deductions for demo mode; PostgreSQL is authoritative in production. The app refreshes at a detected year boundary or on return to a tab, deferring while a drawer is open so unsaved edits are not silently replaced.

Right-side drawers handle focused tasks such as shift edits, daily bulk editing, department details, and rotation editing. Profile creation/editing uses a centered blocking modal with a scrim, inert background, focus trap, Escape/Cancel, and separate identity, team/position, access, recurring allowance, and current-year balance sections. Employee ID remains internal and Title is a read-only automatic output. Annual-request review opens as a centered wide modal so its compact team schedule preview and decision impact remain readable across the affected dates. Authorized Scheduler cell clicks open one-time daily overrides directly; Scheduler edit mode remains reserved for staged day-lead changes. Full employee profile and calendar experiences use the main content area.

Rotation cells, including empty cells, and person rows open the weekly editor directly. There is no rotation edit-mode or person-selection gate. Choices update the drawer controls and rotation workspace in place without redrawing the application shell. The grid previews Lead immediately and marks changed people. One page-level Save Changes commits the selected department's changed people, including explicit Lead choices and confirmed resets. Copy/paste stages weekday shifts while preserving Lead identities. The former separate Save leads action is folded into this shared save.

Direct rotation saves and department paste use `apply_rotation_patterns`, an authorized atomic RPC introduced by migration 029. It updates a version on the chosen effective date or creates a new one, keeps earlier versions and daily exceptions intact, validates every target and shift, and serializes overlapping saves through profile locks. Clipboard contents are cleared on sign-out and role changes.

Migration 030 adds `save_person_rotation` so one person's weekday pattern and explicit Lead choices save atomically. The red star is a fifth visible choice in each day picker, backed by the existing working-day pattern and weekly lead table; no new stored shift status is introduced. Blank lead slots stay unassigned. Choosing a normal shift clears only that person's lead assignment on that weekday. Department copy/paste continues to carry weekday shifts only.

Migration 031 adds `save_rotation_drafts` for one atomic department commit with resolved per-person dates. The page date affects only changed people unless a personal override is supplied. Drafts live separately from authoritative state, survive navigation and reload in account-scoped session storage, and are cleared on successful save or sign-out. Failed saves retain drafts. Rotation rows resolve Lead at their preview date; saved future patterns use at least their own start date. This avoids both unrelated future lead versions and an older row retaining Lead after a current reassignment.

Migration 032 requires explicit review when versions after the chosen start would supersede an edited person's shifts or Lead choices. Save opens a centered list of the affected people and dates. Keep later versions preserves that timeline; Apply onward replaces later rotation versions only for edited people and merges their explicit Lead choices into subsequent department patterns, preserving other slots and departments. The reviewed version snapshots are checked under locks before any writes; a stale review rolls the whole batch back. Replacement is audited, and source versions being moved are protected from deletion. `save_reviewed_rotation_drafts` is the new client entry point, so clients cannot accidentally send review choices to a pre-migration server that would ignore them. The legacy batch RPC also enforces the review guard.

Admin Saved versions / Correct date stages moving a specific version, with a source-date/pattern stale check and a refusal to overwrite an existing destination-date version. Moving a version later restores the prior Lead slots at its former boundary without replacing other people's slots; redundant Lead boundaries are removed. Moving earlier retains its later Lead continuation. All correction/reset operations remain explicit, audited, and Admin-only; ordinary Lead saves remain current/future and direct-department scoped.

Admin-only Delete Rotation opens an in-app confirmation before `reset_person_rotation` removes all versions for the person and clears references to them in weekly lead patterns. This deliberate full reset guarantees No Template instead of falling back to an older version. Daily overrides, daily lead overrides, requests, balances, identities, and other people's patterns remain untouched; the reset is recorded in Activity.

## Scheduling Model

### Rotations

- Rotation patterns contain seven weekday slots.
- Allowed rotational states are Morning, Mid-day, Night, and Weekend.
- Every rotation version has an effective start date.
- The latest version effective on a requested date is used.

### Daily Overrides

- Overrides belong to one profile and one date.
- An override replaces the rotation-derived state for that date.
- Annual, Sick, On Ground, and booked Replacement Days are daily exceptions. A booked replacement day uses a protected override.
- Clearing an override returns the date to its rotation-derived state.
- Approved vacation requests may materialize vacation days into schedule rows for resolution, but the UI treats them as request-sourced vacation rather than manual overrides.

### Schedule Resolution

For a person and date:

1. Find a matching daily override.
2. Find the newest rotation version effective on that date.
3. Resolve the correct weekday slot.
4. Apply selected public holidays to the selected people and dates. Existing Annual, Sick, booked replacement days, and confirmed work take precedence. Legacy team holidays keep their previous precedence below daily overrides.
5. Use the rotation result on regular dates and holidays with scheduled coverage. If no rotation exists, show Unassigned.

Migration 036 adds dated holidays and Low Days credits. Migration 038 adds Scheduler → Enter Public Holiday, where Admin can select a date header or an inclusive date range for everyone shown, and toggle individual shifts. Save the named selection as one batch. Saved Holidays supports editing or removing the batch and managing legacy team entries. Selected holidays snapshot the people chosen at save time, so later membership changes do not reassign their dates. Team → Alerts groups actual holiday days off by person and shows unequal totals within each visible managed team.

Admin and scoped Leads select an eligible Scheduler cell and choose Override day off to record Morning, Mid-day, Night, or On Ground. The date must have started in Cairo. The RPC writes the shift and issues one credit per person and date in the same transaction. If the person worked on charged Annual, the RPC returns one day to its original yearly balance and updates the request deduction. The credit is due 30 calendar days after the worked date. Team → Alerts shows upcoming bookings and due or overdue credits, and lets authorized viewers choose a regular working day by the deadline. Moving or cancelling a booking restores the prior shift. Employees see their own history and deadlines in My Profile → Low Days.

The calendar and credit tables are private. The read RPC resolves holiday applicability against full memberships, including hidden hybrid memberships, and returns credit history only to its owner or an authorized manager. The Analytics snapshot carries scoped holiday applicability and counts both new exceptions as known off days. Annual request validation and approval share the holiday-aware workday calculation and exclude confirmed worked dates. Replacement-day actions never charge the Annual ledger.

Scheduler → Low Days opens Team → Alerts. Migration 037 adds a private events table, scoped reads, and audited event writes. Admin can create organization-wide or team events. Leads can change events scoped entirely to teams they manage. The Events row below Scheduler date headers and Annual review use the same date-range overlay.

## Main Domain Data

- `profiles`: employee identity, role-related details, compatibility department anchor, leave balance, and optional auth link.
- `annual_balance_years`: scoped per-person/year allowance and remaining balance, including archived years and advance-year reservations.
- `employee_profile_departments`: equal operational department memberships.
- `departments`: organizational grouping and minimum coverage target.
- `statuses`: schedule labels, kinds, and visual metadata.
- `rotation_versions`: versioned weekly schedule patterns.
- `schedule_overrides`: per-person, per-date schedule replacements, including manual daily changes and approved vacation request materializations.
- `vacation_requests`: request dates, status, decision data, and deducted days.
- `department_leads`: daily lead assignments.
- `department_lead_rotation_versions`: effective-dated Mon-Sun default lead patterns by department.
- `user_roles`: application access roles.
- `audit_log`: important operational changes.

Employee profiles also carry `seniority_level`, now simplified to `manager`, `lead`, or `artist`. Department lead scheduling uses department membership plus the weekly/daily lead assignment tables; any current department member can be selected as a day lead. `user_roles.lead` remains the separate authorization role for application permissions.

Weekly lead assignment is edited directly inside the rotation grid through a red star on each eligible person's weekday shift. Once assigned, Lead replaces the underlying Morning, Mid-day, or Night label in Scheduler, Rotations, profile calendars, upcoming-shift lists, and request-impact previews. The underlying rotation remains authoritative for calculations, coverage, leave deductions, and history; Lead is a primary presentation of the existing effective-dated lead assignment rather than a fifth stored rotation-template status.

Parent-department lead assignments use the full descendant department scope. A daily override or weekly lead rotation stored on a parent can therefore resolve to a profile assigned to one of its sub-departments. In Scheduler edit mode, an existing parent daily override reopens the parent lead editor so it can be returned to the weekly rotation without direct database cleanup.

## Authorization Model

- The existing Admin account is the sole Admin and can read or manage every operational record.
- Department Leads can read and manage current/future rotations, schedules, hierarchy, memberships, and annual-request decisions only for directly assigned departments.
- Leads can assign currently unassigned profiles to their departments and remove department members, but cannot browse or move profiles assigned only to other departments.
- Employees can read their directly assigned department schedules, rotations, profiles, and hierarchy, create their own annual requests, and update only their own name and profile photo.
- Profile hierarchy (`manager`, `lead`, `artist`) is separate from application access (`admin`, `lead`, `employee`).
- Frontend permission helpers control affordances and visibility.
- Supabase RLS and RPC functions must enforce the actual security boundary.

## Visual Foundation

- Dark charcoal and black surfaces.
- Compact typography and restrained spacing.
- Red reserved for brand actions, selection, warnings, and destructive states.
- The app uses layered translucent black surfaces, toned crimson gradients, white edge highlights, and selective red glows while preserving the core red/black/white identity.
- Shared motion tokens drive hover elevation, press feedback, navigation-triggered staggered view entrances, and drawer/modal transitions. Motion uses transforms and opacity, remains interruptible, does not replay for ordinary in-view updates, and is disabled through `prefers-reduced-motion`.
- The app should feel like a polished operational tech workspace: subtle animated background lines, restrained glows, layered gradients, and satisfying hover feedback are preferred when they do not reduce scan speed or legibility.
- Shift-specific colors remain strongest on icons and compact markers. Related schedule, rotation, profile-calendar, request-impact, and status-choice surfaces may carry a restrained semantic tint capped around 20% so the status is visible without competing with the red/black/white workspace.
- Scheduler timelines and profile month calendars use a shared separated-card rhythm: compact gaps, rounded charcoal cells, subtle white inner edges, and red-only today/selection emphasis inspired by modern calendar dashboards without adopting their blue palette.
- Unavailable states remain quieter than working states.
- Scheduler cells use a restrained semantic tint together with the colored icon and text label; working/non-working structure and warnings remain distinguishable without relying on color alone.
- Weekend, Annual, and Sick surfaces use a quiet diagonal hatch with dimmed content so working shifts dominate the resting scan state, while their semantic left rails remain fully visible without hover. Hover and keyboard focus restore full content clarity. Pending Annual markers appear only on eligible working days. The Scheduler groups visible dates inside compact, closed ISO week bands with week numbers; a quiet Monday seam aligns the rows beneath each band without creating repeated colored arcs.
- Annual eligibility is resolved from the current effective rotation plus daily overrides. Weekend, Sick, and existing Annual days are excluded from request impact, balance deductions, and override writes. The browser prevents zero-impact submissions and approvals, while Supabase rechecks the same constraint at insert and approval time so overlapping requests cannot overwrite protected days.
- Scheduler controls sit outside the horizontal timeline scroller and wrap within the viewport. Shared compact typography and a percentage zoom control keep navigation consistent. The main board omits people/status filters, lead-name subtitles, and the coverage summary row; coverage remains available in date details and Annual approval impact.
- Week boundaries use a 12px inset aligned between Monday cells and their numbered week bands, creating an 18px visible separation versus the normal 6px day gap. Edit daily leads names the staged day-lead tool; ordinary shift cards open one-time overrides directly and do not require that mode.
- Cards are used for repeated entities and focused tools, not every page section.
- Icons and concise status tags carry repeated information.

## Persistence And Security

- Supabase Auth provides user sessions.
- Password recovery uses Supabase recovery emails and a public in-app password update screen. Recovery sessions are marked as pending, cannot load scheduler data, and are cleared after the password changes so the user signs in again normally.
- Profiles may be created before auth users exist.
- Email matching does not claim profiles. An Admin must approve each self-service submission and choose the employee profile relationship.
- The browser uses the public Supabase anon key.
- RLS policies and RPC functions protect privileged operations.
- Service-role keys and private credentials must never enter the frontend repository.
- Unclaimed auth accounts must not receive operational read access.
- Internal `SECURITY DEFINER` helpers must not be directly executable unless they perform their own authorization checks.

## Runtime Configuration

Runtime environment values are not committed in frontend modules. `index.html` loads `runtime-config.js` before the application module and `src/config.js` reads `window.__SPORT360_CONFIG__`.

- Local development: `scripts/localServer.js` generates `/runtime-config.js` from ignored `.env.local`.
- Local development serves `/assets/*` from the source `src/` directory.
- Static builds: `scripts/build.js` writes `dist/runtime-config.js` from deployment environment variables and publishes browser assets under `dist/assets/`.
- Hosted Vercel and Netlify builds require `SPORT360_SUPABASE_URL` and `SPORT360_SUPABASE_ANON_KEY`.
- `SPORT360_ALLOW_SIGNUP=false` hides public account creation for the internal release.
- `SPORT360_GOOGLE_AUTH_ENABLED=true` shows Google authentication after its OAuth client is configured in Google and Supabase.
- `SPORT360_PRELAUNCH_MODE=true` routes non-Admin accounts to self-service profile setup and its holding state.
- `SPORT360_RELEASE` identifies the deployed release; hosted builds fall back to `VERCEL_GIT_COMMIT_SHA` or `COMMIT_REF`.

## Profile Photo Storage

- New profile images are stored in the private Supabase Storage bucket `profile-photos`.
- `employee_profiles.photo_url` stores a stable `storage:profile-photos/<profile-id>/<object>` reference rather than image bytes or a temporary URL.
- Claimed users receive short-lived signed read URLs when application state loads.
- Admins may write any profile folder; other users may write only the folder matching their claimed profile ID.
- Existing data URLs and external photo URLs remain readable as legacy fallback until each image is replaced.
- Prelaunch submissions use the separate private `profile-onboarding-photos` bucket. Users may write only inside their Auth user folder; approved photos remain readable through the linked employee profile.

## Schedule Analytics

Migration 034 adds the read-only `get_schedule_analytics(year, department_id, direct_only)` RPC. It requires an authenticated, claimed Admin or Lead. Admin can select all people or a parent department plus descendants; Lead can select only directly assigned departments and their members. Shared members count once. Admin Lead Preview explicitly requests a direct-only snapshot to avoid inheriting Admin descendant visibility. Employee has neither the navigation nor RPC access. The response omits emails, private notes, request reasons, balances, and out-of-scope memberships.

The RPC returns only required schedule fields for one calendar year, including the last effective rotation before the year. The client resolves shifts with existing Scheduler helpers rather than duplicating those rules in SQL. Month/quarter/year filters share the scoped yearly snapshot. Viewer/role/preview/scope/year keys and request tokens reject stale results; mutations, reload, sign-out, and explicit refresh invalidate the snapshot. An unavailable RPC is isolated to Analytics and does not block other views.

Charts use native SVG and semantic HTML without a library or framework. Analytics counts saved planned person-days, not attendance or hours. Lead replaces the underlying working label; On Ground remains distinct. Unknown days are visible, fully unknown dates are gaps and excluded from weekday averages, and opening-balance deductions never become dated leave. Current memberships define historical scope; there are no historical membership snapshots. See `docs/ANALYTICS.md` for activation and definitions.

## Known Architectural Limits

- `src/main.js` and `src/styles.css` are large and will eventually benefit from modularization.
- There is no automated browser test suite yet.
- Configuration is currently committed directly rather than injected per environment.
- Profile images need a fully verified Supabase Storage workflow.
- Migration application state must be reconciled before production release.
- Loading, offline, and recovery behavior need further hardening.

## Direction For Growth

Prefer incremental modularization over a framework rewrite. Extract a module only when a domain boundary is stable, such as scheduling, permissions, people, requests, or shared UI primitives. Preserve behavior and tests while moving code.
