# Decision Log

This is an append-only record of meaningful product and technical decisions. Add new entries with a date and identifier. If a decision changes, add a superseding entry rather than deleting the old one.

## D-001 - Department-Based Scheduler

**Status:** Accepted

People are shown as rows and dates as columns. Scheduling and coverage are viewed in the context of a selected department.

## D-002 - Label-Based Shifts

**Status:** Accepted

The product schedules named states rather than exact hours. Payroll, overtime, and time-clock calculations are outside the current scope.

## D-003 - Rotation And Exception Separation

**Status:** Accepted

Morning, Mid-day, Night, and Weekend are rotational states. Vacation, Sick, and On Ground are date-specific exceptions and must not be stored as rotation templates.

## D-004 - Versioned Rotations

**Status:** Accepted

Rotation changes receive effective start dates. New versions must preserve historical schedule resolution rather than rewriting old dates.

## D-005 - Manual Overrides Win

**Status:** Accepted

A manual override for a person and date takes precedence over the rotation-derived state. Clearing it restores the rotation result.

## D-006 - Vacation Deducts Scheduled Work Days

**Status:** Accepted

Vacation approval deducts only affected scheduled work days and writes Vacation overrides for those dates. Approval should preview balance and coverage impact.

## D-007 - Pre-Created Profiles And Email Claiming

**Status:** Accepted

Admins may create employee profiles before users have auth accounts. A user claims the matching unassigned profile by signing in with the same email.

## D-008 - Role Boundaries

**Status:** Accepted

Admins manage the full system. Department leads manage allowed data for their departments. Employees primarily view their own data and create permitted requests. Supabase RLS/RPCs remain the security authority.

## D-009 - Dark Compact Visual Direction

**Status:** Accepted

The UI is dark, compact, desktop-first, and operational. Red is a brand/action accent. Shift colors aid scanning, while unavailable states remain restrained.

## D-010 - Profile Calendar Placement

**Status:** Accepted

Personal and employee month calendars belong in full profile views. Side drawers contain lighter profile details and actions rather than a full calendar.

## D-011 - People Views

**Status:** Accepted

The People area supports four presentations: grouped default, department kanban, detailed horizontal list, and compact department-free tiles.

## D-012 - Department Membership Workflow

**Status:** Accepted

Adding a member begins with a choice between assigning existing unassigned profiles and creating a new profile. Existing profiles support multi-select. Removing a department applies immediately.

## D-013 - User-Created Rotation Presets

**Status:** Accepted

The app does not ship opinionated rotation preset buttons. Users create and save their own presets.

## D-014 - Activity Visual Language

**Status:** Accepted

Activity type is communicated by a subtle colored marker and tag. Full activity rows should not receive strong color tints. Assignment and unassignment remain visually distinguishable but restrained.

## D-015 - Current Frontend Architecture

**Status:** Accepted for current stage

Continue with the existing vanilla JavaScript application while core workflows stabilize. Modularize incrementally when boundaries become clear; do not perform a framework rewrite without explicit approval.

## D-016 - GitHub Review Workflow

**Date:** 2026-06-20
**Status:** Accepted

`main` is the stable branch. Coherent changes are developed on focused `codex/<description>` branches, pushed to GitHub, and reviewed through pull requests before merging.

## D-017 - Living Project Documentation

**Date:** 2026-06-20
**Status:** Accepted

Repository knowledge is maintained in `docs/VISION.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/TODO.md`. Agent-specific instructions live in root `AGENTS.md` for automatic discovery.

## D-018 - Dependency-Free Static Deployment Build

**Date:** 2026-06-20
**Status:** Accepted

The app remains framework-free. Deployment uses a small Node script that copies `index.html` and `src/` into `dist/`; hosting configuration publishes that directory with an SPA fallback.

## D-019 - Claimed Profiles Gate Operational Data

**Date:** 2026-06-20
**Status:** Accepted

Authentication alone does not grant access to employee or schedule data. The signed-in account must be linked to an employee profile. An unmatched signup receives no application role or operational read access.

## D-020 - Privileged Database Helpers Are Internal

**Date:** 2026-06-20
**Status:** Accepted

`SECURITY DEFINER` functions that do not perform their own authorization checks are internal helpers. They must not be directly executable by browser roles and should only be reached through authorized RPC workflows.

## D-021 - Roadmap And Tactical Queue Separation

**Date:** 2026-06-21
**Status:** Accepted

`docs/ROADMAP.md` is the durable phased project plan and records phase status and acceptance gates. `docs/TODO.md` is the short actionable queue for current and immediately upcoming work. Both are maintained as the project progresses.

## D-022 - Production Gate Follows Department Rotations

**Date:** 2026-06-21
**Status:** Accepted

The project enters production hardening immediately after department-wide rotation editing is complete. Later product expansion does not block the first production release unless evidence from hardening or the pilot establishes that it is required.

## D-023 - Internal Production Rollout

**Date:** 2026-06-21
**Status:** Accepted

The first production release is an internal Sport360 rollout. One department pilots the release for five business days before broader internal expansion, subject to the documented production acceptance gate.

## D-024 - Admin-Controlled Account Onboarding

**Date:** 2026-06-21
**Status:** Accepted

Production accounts are created or invited by an Admin. Public account creation is hidden when runtime configuration sets `allowSignup` to false. Existing email-based profile linking remains part of onboarding.

## D-025 - Initial Production Device Support

**Date:** 2026-06-21
**Status:** Accepted

The initial production guarantee covers current Chrome and Edge on desktop and laptop displays 1024px wide and above. Mobile behavior remains best-effort until mobile is explicitly promoted to a supported target.

## D-026 - Department Lead Rotation

**Date:** 2026-06-25
**Status:** Accepted

Each department has an effective-dated seven-day lead rotation. The Scheduler resolves that weekly default for every date, while `department_daily_leads` remains a one-day override. This allows weekend and weekday leads to differ without duplicating daily assignments or rewriting historical patterns.

Lead assignment candidates come from current department membership, not from a permanent profile-level Department Lead tag. A senior can therefore lead while the usual lead is on vacation.

## D-027 - Equal Department Memberships

**Date:** 2026-06-25
**Status:** Accepted

An employee can belong to multiple equal departments. The profile editor shows departments as one checklist, and hierarchy, schedule, and rotation views use those memberships directly.

A legacy `department_id` value is still kept internally as a compatibility anchor for existing permission checks and older database objects, but the UI does not present it as primary.

## D-028 - Seniority Hierarchy View

**Date:** 2026-06-25
**Status:** Superseded by D-037

The Hierarchy workspace lets the user select one or more departments, then groups visible employees from Manager through Department Lead, Senior, Mid-level, and Junior within each selected department. It is a people-structure view based on profile seniority, not a replacement for application access roles or daily lead scheduling.

## D-029 - Temporary Admin Control For Pseudo Profiles

**Date:** 2026-06-27
**Status:** Accepted

During setup, profiles are pseudo profiles created and controlled by Admins. Admins can create, edit, unlink, and delete these profiles while the team structure is still being shaped.

Longer term, employees should be able to create or claim their own profile and edit basic personal information, while Admins retain control over operational fields such as roles, departments, rotations, and scheduling rules.

## D-030 - Vacation Requests And Lead Replacement

**Date:** 2026-07-04
**Status:** Accepted

Vacation is not manually assigned from the shift override editor. Vacation must come through the vacation request and approval workflow so balance deduction, schedule impact, and audit history stay connected.

If a scheduled department lead becomes unavailable through Vacation, Sick, On Ground, or another non-working state, the Scheduler should stop showing that person as the active lead for that day and surface a missing-lead alert. Approving vacation for an affected lead should guide the manager to assign a replacement daily lead.

## D-031 - Manual Override Label Reserved For Manual Edits

**Date:** 2026-07-04
**Status:** Accepted

Approved vacation days should not be shown as overrides in the interface. Even if the persistence layer stores request-approved vacation as schedule replacement rows, the user-facing source is "Vacation request". The "Override" label and manual counts are reserved for manager-entered daily changes.

## D-032 - Any Department Member Can Cover Day Lead

**Date:** 2026-07-04
**Status:** Accepted

Daily and weekly department lead assignment is an operational scheduling choice, not a permanent seniority or title gate. Any current member of the department can be selected as day lead when coverage requires it. Seniority and application roles remain useful for hierarchy and permissions, but they must not prevent a temporary day-lead assignment.

Scheduler cells should use the vertical bar as the primary working versus non-working signal. Shift and exception types should be secondary through icon, label, and subtle texture so the grid stays readable.

## D-033 - Free-Plan Backup Path

**Date:** 2026-07-05
**Status:** Accepted

While the production Supabase project remains on the Free plan, Phase 4 backup readiness uses manual logical exports stored off-site rather than Supabase managed daily backups.

Before production release, migrations, bulk edits, or pilot launch, the team must create a manual export and rehearse restoring it into a non-production Supabase project. Managed dashboard backups become the preferred path only after upgrading to a plan that includes them.

## D-034 - Online Preview Before Full Backup Gate

**Date:** 2026-07-12
**Status:** Accepted

The app may be put online for internal preview through the connected static host before the full Phase 4 backup/restore gate is closed.

This does not mark the project production-ready. The SQL backup helper is currently blocked on the local Windows Docker/WSL configuration required by Supabase CLI dumps. Until that is repaired, a Supabase dashboard CSV export stored outside the repository is the temporary safety net for preview use only.

The full production-ready internal release still requires a verified logical export, restore rehearsal in a non-production Supabase project, browser health checks, live role/auth checks, rollback ownership, and pilot signoff.

## D-035 - Futuristic Operational UI Polish

**Date:** 2026-07-15
**Status:** Accepted

The visual direction should move beyond a plain dark admin tool toward a polished Sport360 operational workspace with subtle animated background lines, layered gradients, restrained glows, and satisfying hover feedback.

This polish must remain secondary to scan speed, schedule readability, and compact operational density. Animations should be slow, faint, and mostly interactive or ambient in the background; shift-state colors and lead/edit affordances must stay legible and purposeful.

## D-036 - Annual Leave Terminology

**Date:** 2026-08-08
**Status:** Accepted

The user-facing product language should use **Annual** instead of Vacation for leave balances, requests, approvals, filters, and calendar/schedule labels.

Existing Supabase table names, function names, status ids, and audit action ids may continue using `vacation` as legacy internal identifiers until a later database cleanup is worth the migration risk. The UI should translate those internal ids into Annual terminology.

## D-037 - Simplified Hierarchy

**Date:** 2026-08-08
**Status:** Accepted

The people hierarchy is now Manager, Lead, and Artist only. Artist covers operational creative titles such as Motion Graphics Artist and Video Editor; Senior, Mid-level, and Junior are not part of the hierarchy model.

Daily lead assignment remains separate from hierarchy. Any department member can still be chosen as day lead when operations require coverage.

## D-038 - Low Days And Events Are Workflows

**Date:** 2026-08-08
**Status:** Accepted

Low Days are owed time-off credits created when someone works a day they should not have worked. They need a workflow with creation reason, approval/confirmation, balance tracking, replacement day selection, schedule impact, and audit history.

Events are shared calendar items that can be assigned to people. When an event is assigned, the app should ask whether the assigned people should also become On Ground for the event dates instead of changing schedule state automatically.

## D-039 - Self-Service Password Recovery

**Date:** 2026-09-28
**Status:** Accepted

The production sign-in screen provides Supabase email-based password recovery while public account creation remains disabled. Recovery requests always use generic confirmation text so the interface does not disclose whether an account exists.

Recovery tokens may authenticate only the password-update flow. A recovery-pending session must not load scheduler data, and the temporary session is cleared after the password changes so the user signs in again with the new password.

## D-040 - Desktop Browser Parity

**Date:** 2026-10-03
**Status:** Accepted

Production verification covers current Chrome, Edge, and Firefox. A workflow accepted for the internal release must behave consistently in all three browsers; browser-specific gaps remain release issues until resolved or explicitly removed from the support scope.

Automated viewport checks continue to cover the Chromium implementation at the supported desktop widths. Manual production checks provide Edge and Firefox parity evidence until the automated matrix expands.

## D-041 - Prelaunch Profile Reservations

**Date:** 2026-10-10
**Status:** Accepted

Before the scheduler opens to employees, public account creation may run in a controlled prelaunch mode. A newly authenticated account reserves the employee profile with the same work email but does not populate `employee_profiles.user_id` or create an application role.

This reservation keeps the account outside the existing claimed-user RLS boundary. Non-Admin users see only a profile confirmation page, while existing Admins retain the full scheduler for setup work. When prelaunch mode is disabled, the normal claim RPC promotes the matching reservation into an active profile link and removes the reservation.

## D-042 - Admin-Approved Self-Service Onboarding

**Date:** 2026-10-10
**Status:** Accepted; supersedes D-007 and D-041 for account onboarding

Employees create their own Auth accounts and submit only a name and optional profile photo. The submission is stored separately from operational employee profiles and grants no scheduler access.

An Admin reviews each submission and either links it to an existing unclaimed employee profile or creates a new unassigned employee profile. The Admin then manages departments, title, hierarchy, application role, leave balances, rotations, and scheduling. Email matching must not automatically reserve or claim an employee profile.

## D-043 - Google Authentication Uses The Same Approval Gate

**Date:** 2026-10-12
**Status:** Accepted

Google OAuth may create or authenticate a Supabase Auth identity without sending a confirmation email. It does not grant operational access, claim an employee profile, or bypass prelaunch mode.

New Google-authenticated users follow the same isolated name/photo submission and explicit Admin link-or-create workflow as email/password users. The Google button remains runtime-gated until the OAuth client, Supabase provider, and allowed redirect URLs are configured.

## D-044 - Direct Department Role Boundaries

**Date:** 2026-10-14
**Status:** Accepted

Sport360 has one protected Admin account with unrestricted access. Leads can read and manage rotations, schedules, hierarchy, memberships, and annual-request decisions only for departments to which their employee profile is directly assigned. Leads may add unassigned profiles to those departments but cannot browse or move people from other departments. Employees can read their own directly assigned department data, create their own requests, and update only their own name and profile photo. Supabase RLS and authorized RPCs enforce these boundaries independently of the frontend.

## D-045 - Admin Role Preview Is Read-Only UI Simulation

**Date:** 2026-10-14
**Status:** Accepted

The sole Admin may preview the Lead or Employee interface for one department using an existing employee profile as the representative identity. Preview mode changes only frontend visibility and permission affordances; the authenticated Supabase session remains Admin and is clearly identified as such.

All application writes, including local rotation-preset changes, are blocked while preview mode is active. The preview is not persisted across reloads and is not a substitute for production RLS verification with real role accounts.

## D-046 - Cinematic Polish Preserves The Operational Palette

**Date:** 2026-11-05
**Status:** Accepted

Sport360's interface uses red, black, and white as its visual foundation. Perceived depth comes from nuanced red hues, transparency, layered black surfaces, soft white edge highlights, and selective glow rather than adding a new decorative accent palette. Schedule-state colors remain available only where they communicate operational meaning.

Interaction motion uses shared fast, base, and slow timings. Buttons and cards provide immediate hover and press feedback; views enter with a short stagger; drawers and creation modals animate both in and out. These effects use transform and opacity, never block interaction, and are removed when the user prefers reduced motion.

## D-047 - Schedule Status Color Lives In Icons

**Date:** 2026-11-05
**Status:** Accepted

Scheduler cells, profile calendar days, and compact shift rows use neutral black and charcoal surfaces. Morning, Mid-day, Night, Weekend, Annual, Sick, and On Ground retain distinct muted colors only on their icons and small semantic markers.

This preserves fast status recognition without turning the operational workspace into a grid of competing colored panels. Hover and selection depth come from neutral elevation, white edge highlights, and restrained Sport360 red rather than enlarging the status palette.

## D-048 - Calendar Surfaces Use Separated Neutral Cards

**Date:** 2026-11-05
**Status:** Accepted

The Scheduler timeline and profile month calendar use compact gaps and individually rounded charcoal cards instead of a continuous tinted spreadsheet surface. Subtle white inner edges and layered black elevation separate dates while keeping the board dense and operational.

Morning, Mid-day, Night, Weekend, Annual, Sick, and On Ground never tint the card surface. Their icons remain distinct; Sport360 red is reserved for today, selection, editing, and warning emphasis.

## D-049 - Daily Overrides Open Directly From Scheduler Cells

**Date:** 2026-11-05
**Status:** Accepted

For authorized Admins and department Leads, clicking a Scheduler shift cell opens the one-time daily-change editor directly. Scheduler edit mode remains a separate staged workflow for assigning day leads and does not gate ordinary daily overrides.

Employees and read-only role previews continue to receive the day-detail view without write controls.

## D-050 - People Structure Uses One Team Navigation Group

**Date:** 2026-11-05
**Status:** Accepted

People, Hierarchy, and Departments remain distinct operational views but are bundled into one compact Team group in the primary navigation. This keeps each established workflow intact while reducing top-level navigation noise and making the relationship between people, structure, and departments explicit.

## D-051 - Operational Status Surfaces Use A Restrained Tint

**Date:** 2026-11-05
**Status:** Accepted

Scheduler cells, rotation cells, profile-calendar days, request-impact cells, and status choices may use a subtle semantic tint capped around 20%. Icons and text labels remain the primary status identifiers, so color is never the only signal.

This supersedes the no-tint portions of D-047 and D-048 while preserving their compact separated-card layout, restrained palette, and red emphasis for selection, editing, warnings, and brand actions.

## D-052 - Team Is One Integrated Workspace

**Date:** 2026-11-05
**Status:** Accepted

People, hierarchy, and department management share one Team destination and one department context. The workspace combines department selection, organization summary, hierarchy, and the existing people presentations without adding internal People, Hierarchy, or Departments tabs.

This supersedes D-050's decision to retain three distinct operational views. Existing permission boundaries, profile drawers, department actions, and people presentation modes remain intact.

## D-053 - Weekly Lead Assignment Lives In Rotation Cells

**Date:** 2026-11-05
**Status:** Accepted

The weekly lead control is represented by a red star inside each person's weekday rotation shift. Authorized users choose the lead in the same grid where the weekly pattern is understood instead of using a separate lead panel above it.

The star writes to the existing effective-dated department lead rotation and is not a fifth rotational status. Morning, Mid-day, Night, and Weekend remain the only rotation-template states.

## D-054 - Lead Replaces The Underlying Shift In Presentation

**Date:** 2026-11-07
**Status:** Accepted

When a working person is the resolved department lead for a date or weekday, Scheduler, Rotations, profile calendars, upcoming shifts, and request-impact previews display Lead as the primary shift with the red star icon. Morning, Mid-day, or Night must not remain visible beneath a separate lead badge.

The underlying rotation result remains authoritative for availability, coverage, leave deductions, effective-dated history, and persistence. Weekend, Sick, and Annual are not eligible Lead presentations. Those non-working states use a subdued diagonal hatch, and Pending Annual appears only on affected working days. Semantic tints remain restrained, while status-matched left rails and Monday week gutters improve one-glance scanning without introducing a louder palette.

## D-055 - Resting Contrast Separates Work From Off Days

**Date:** 2026-11-07
**Status:** Accepted

Weekend, Annual, and Sick cells sit noticeably behind working shifts at rest through lower opacity, reduced brightness and saturation, and only a minimal softness. Their text, icons, and interaction remain available; hover and keyboard focus restore full clarity and a brighter semantic surface instead of leaving off days permanently low-contrast.

Each Monday begins after a deliberate dark gutter with a restrained red edge that continues through the date, coverage, and employee rows. This week boundary must remain visible in dense two-week and month Scheduler ranges without introducing a competing accent color.

## D-056 - Week Bands And Annual Eligibility Are Explicit

**Date:** 2026-11-07
**Status:** Accepted

The Scheduler labels each visible ISO week with one closed, numbered band above its dates. Monday row seams stay quiet and neutral; they align content beneath the band instead of repeating curved red dividers through every row.

Weekend, Sick, and existing Annual days are never eligible for another Annual write. Mixed requests affect only remaining eligible working days, while requests with no eligible days are rejected. Eligibility is recalculated at approval so schedule changes or overlapping pending requests cannot cause duplicate deductions or overwrite protected daily statuses. On Ground remains eligible because it is a working-day exception.

## D-057 - Scheduler Controls Stay With The Viewport

**Date:** 2026-11-07
**Status:** Accepted

The Scheduler toolbar lives outside the horizontal timeline scroller and uses compact shared typography. Zoom uses minus/plus buttons with a percentage indicator. People and shift filters, per-date lead-name subtitles, and the coverage summary row are removed from the board to prioritize the shift cards. Date details and Annual approval retain coverage calculations and focused information. Authorized daily changes and clearing overrides work directly from a shift card without enabling the staged lead-edit mode.

## D-058 - Direct Rotation Editing And Pattern Copy

**Date:** 2026-11-08
**Status:** Accepted

Authorized users open a person's weekly rotation from any populated or empty rotation cell or the person's row, without an Edit Rotation or Continue step. Copy/paste carries only the seven weekday shifts. Individual paste opens the editor for review; department paste shows its target people, pattern, and effective start before one atomic save. Access roles, lead identities, balances, requests, and daily exceptions are never copied.

The chosen effective date identifies a version: saving again on that date updates it, while a different date creates another version. The default start is today, or the future date of the opened version; earlier versions remain unchanged unless the Admin explicitly chooses their date. Leads cannot save into the past. Weekly lead stars retain an independent Save leads action.

## D-059 - Explicit Lead Choices And Full Person Rotation Reset

**Date:** 2026-11-08
**Status:** Accepted

Weekly lead slots may be unassigned and must never fall back to the first department member. Each day in the person rotation editor offers Lead as a red-star choice alongside the four ordinary shifts. Selecting it presents Lead as the day's primary shift; choosing an ordinary shift clears that person's lead for that weekday. Pattern and lead choices persist together through one authorized transaction, while other people's assignments remain intact unless explicitly replaced by a selected Lead.

An Admin may deliberately reset a person's rotation to No Template. The confirmation states that all weekly versions, including historical/future versions across departments, and that person's weekly lead references will be removed. This is an explicit exception to normal history preservation. Leads cannot perform this full reset because they cannot delete historical versions. Daily exceptions, daily lead overrides, requests, balances, accounts, and existing activity remain preserved.

## D-060 - Preview Rotation Changes And Commit Together

**Date:** 2026-11-08
**Status:** Accepted

Rotation edits, explicit Lead choices, shift paste, and confirmed resets become drafts, displayed immediately with a changed-person marker. The selected department has one Save Changes action that is disabled until something changes. Drawer Done only closes the editor. Per-person Undo and department Discard changes reverse unsaved edits. Pending drafts remain separate from stored operational state and survive navigation and reload for the signed-in account.

Only changed people are submitted. Each inherits the page effective start unless their personal date overrides it. Moving the page date does not create versions for untouched people. The database commits the changed people together or rolls everything back, including all weekly Lead changes. Copy/paste carries shifts without mutating Lead identities. The board resolves Lead at the effective date being previewed and shows Lead separately in its summary instead of counting it as Morning or Night.

For an incorrectly saved start date, Admin opens Saved versions / Correct date and moves that specific version through the shared save. A conflicting destination date or changed source version is rejected. This is a deliberate, audited exception to normal immutable-date history: other rotation versions, daily exceptions, requests, and balances stay intact. Full Delete Rotation remains the separate reset-to-No-Template workflow and is also staged for the overall save.

## D-061 - Review Later Versions Before Backdated Rotation Saves

**Date:** 2026-11-08
**Status:** Accepted

An empty Lead version beginning November 8 superseded valid November 1 assignments. The user removed that specific empty version and confirmed restoration. Effective start remains a version boundary, but later shift/Lead boundaries must be visible before saving changed people. The review lists their dates and requires Keep later versions or Apply from these dates onward.

Apply onward explicitly replaces later rotation versions for the edited people and merges their chosen Lead weekdays into subsequent department patterns. Other people, unrelated Lead slots/departments, earlier versions, and daily exceptions remain intact. Leads remain limited to direct departments and current/future dates. A locked snapshot comparison rejects concurrent changes so the reviewed outcome cannot silently change before commit; replacement is audited. Ordinary copy/paste still preserves Lead identities.

Scheduler week spacing increases modestly while keeping week bands and cells aligned. Edit Schedule is renamed Edit daily leads to distinguish staged Lead assignments from direct one-time shift edits.

## D-062 - Foldable Department Navigation And Direct Hierarchy Moves

**Date:** 2026-11-08
**Status:** Accepted

Team remains one workspace with Hierarchy and Directory as switchable tabs sharing the selected department. The department rail nests saved parent/child relationships beneath All teams and folds independently of selection. Directory retains its existing four views. New Department and Member actions use centered icon/text alignment.

Dragging a person between hierarchy rows changes only Manager / Lead / Artist through the existing authorized RPC. A level selector provides the same action for keyboard, touch, and non-drag pointer use. This does not assign a department, change sign-in permissions, or change scheduled Lead shifts. The onboarding placeholder Pending assignment means the job title has not been set; Team presents that clearer description without modifying records. Duplicate signup/operational identities require explicit reconciliation before historical data entry; no automatic merge or live backfill is part of this change.

## D-063 - Manual Annual Opening Balances, November Schedule Cutoff

**Date:** 2026-11-08
**Status:** Accepted

Skip schedule reconstruction before November 2026. Admin enters the recurring Annual allowance and current remainder separately through the existing Edit Profile controls: `15` allowance and `5` remaining displays `5 / 15`. Do not manufacture ten historical Annual days or requests to achieve that balance. The allowance remains configured until changed; future approved leave deducts from the current remainder. Leave already reflected in the manual balance must not be imported and deducted again. No automatic yearly reset or yearly ledger is introduced by this setup decision.

## D-064 - Automatic Annual Renewal With Preserved Year Records

**Date:** 2026-11-08
**Status:** Accepted; migration 033 and all five audit 021 checks confirmed by the user on 2026-11-09

At the start of each calendar year in Africa/Cairo, each person's Annual budget renews from their saved allowance without carrying unused days forward. Keep the prior year's allowance, remaining balance, requests, deductions, and schedule records. Current manual opening balances are imported unchanged; first renewal after activation in November 2026 is January 1, 2027. A database job performs renewal even when no app is open; scoped startup catch-up handles missed jobs or a paused project after resumption.

Approval charges eligible dates to their own years atomically. Already approved next-year leave remains reserved, so a 15-day allowance with two booked next-year days opens at 13 available days, not 15 free days. Saved allowance changes adjust future-year budgets while leaving archived years intact and cannot undercut already approved future bookings. Current-year manual adjustment remains independent and Admin-only. A stale profile form cannot overwrite a renewed balance or concurrent deduction. No client can force a future-year reset.

Requests predating yearly tracking cannot infer an opening balance from unknown history. Installation preserves existing current remainders and identifiable future reservations; inconsistent future Annual records fail preflight for explicit review instead of guessing. Rollover and manual adjustments are audited. Automatic renewal does not cancel requests, clear exceptions, rewrite rotations, or import pre-November schedules.

## D-065 - Scoped Planned-Schedule Analytics

**Date:** 2026-11-09
**Status:** Accepted; migration 034 applied and all five audit 022 checks confirmed by the user on 2026-11-10

Provide Analytics to the Admin and department Leads only. Admin can inspect the organization or a department subtree; Lead remains limited to direct departments, and Employee cannot invoke the analytics RPC. Use a sanitized, read-only yearly snapshot and the same effective-rotation, override, and Lead resolution helpers as the Scheduler. Never infer attendance, hours, productivity, or historical department membership that the system has not recorded.

Count each person/date once. Lead replaces the underlying working-shift category; On Ground stays separate. Annual/Sick charts count saved dated leave, not pending requests or manual opening-balance deductions. Mark unknown schedules explicitly and do not turn missing history into zeros. Show monthly leave for the selected calendar year alongside the selected month/quarter/year staffing period, with explicit labels. Preserve the compact charcoal/red identity with restrained chart accents, accessible exact-value inspection and tables, and no chart dependency or framework migration.

## D-067 - Leaf Teams, Derived Titles, and Manager Structure Permissions

**Date:** 2026-11-10
**Status:** Accepted; migration 035 and audit 024 pending production application

Video Unit is an organizational container, never a direct person assignment. Video Edit and Motion Graphics are leaf teams; a person may belong to either or both. Show concise leaf names in assignment controls and person tags. Derive operational Title from team and Artist/Lead/Manager position using the nine agreed mappings in `docs/TEAM_STRUCTURE.md`. Employee codes remain internal and existing codes are preserved.

Admin may change all team structures. A non-Admin must have both Manager position and Lead access role; Manager with Employee access is insufficient. Limit membership changes to managed teams, preserve hidden memberships, and require management of every target team before changing a hybrid person's global position. Protect the sole Admin and manager self-access. Keep Role and Annual settings Admin-only; everyone retains own name/photo editing. Enforce these rules through guarded RPCs and triggers, including legacy paths, rather than relying on disabled controls.

Open profile editing as a centered blocking modal with focus containment, restrained charcoal/red styling, separate sections, and larger Annual controls. Distinguish recurring allowance from the current year's remainder. Preflight parent-only assignments for explicit Admin reconciliation; never infer teams or disturb operational history. D-066 is reserved by the separate Analytics readability PR #38.

## D-068 - Low Days Deadlines and Public Holidays

**Date:** 2026-11-11
**Status:** Accepted

Confirming work on a scheduled day off or a configured public holiday records the working shift and earns one Low Days credit per person and worked date. The replacement day must be taken by the date 30 calendar days after work, inclusive, using the Cairo calendar. The replacement is a separate schedule exception with no Annual deduction. Admin and Leads can book, move, or cancel an upcoming replacement within their team scope. Past bookings and earned credits remain in history. Overdue credits remain visible for review and the deadline stays enforced.

Show due-soon credits within seven days and overdue credits in Team Alerts for Admin and Leads. Employees see their own balance and deadlines in My Profile. Admin enters the observed holiday name and date, chooses organization-wide or selected teams, and decides between a day off and scheduled coverage. Existing daily changes take precedence. Holiday days off and replacement days are excluded from Annual eligibility and treated as known off days in Analytics.

## D-069 - Schedule Events and Scoped Role Preview

**Date:** 2026-11-12
**Status:** Accepted

Events have a name, inclusive date range, and scope covering selected teams or the entire organization. They appear on Scheduler date headers and in Annual review for affected teams. Event changes are audited and leave rotations, scheduled shifts, and balances intact.

Role Preview has its own Settings tab. Admin selects the actual role and a department before choosing a linked profile. Managers with Lead access select an Employee from the teams they share. Preview stays read-only and keeps the original Supabase session.

## D-070 - Scheduler Holiday Selections and Worked Leave

**Date:** 2026-11-12
**Status:** Accepted

Admin assigns named public holidays from the Scheduler using a whole displayed team on a date or date range, or individual person-date cells. Store each saved selection as a batch and keep legacy holiday scope and precedence. A selected holiday takes precedence over normal shifts. Existing leave, replacement bookings, and confirmed work retain their recorded status. Report differences in days off within each team under Alerts.

Override day off records a working shift and earns one Low Days credit when the selected date is Weekend, a public holiday, Annual, or Sick. If the Annual override links to an approved charge, return one day to its original year and adjust the recorded deduction in the same transaction.
