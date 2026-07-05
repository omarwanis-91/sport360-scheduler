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
| `src/data.js` | Seed/demo state and initial domain data. |
| `src/config.js` | Supabase and application configuration. |
| `server.js` | Local static file server. |
| `scripts/build.js` | Creates the deployable `dist/` directory. |
| `scripts/freePlanBackup.js` | Runs the Supabase Free-plan manual export helper without storing database credentials. |
| `scripts/verifyFreePlanBackup.js` | Verifies a manual export folder has the expected files before restore rehearsal. |
| `netlify.toml` | Netlify build, publish, and SPA fallback settings. |
| `vercel.json` | Vercel build, output, and SPA rewrite settings. |
| `supabase/migrations/` | Database schema, RLS, and RPC evolution. |
| `supabase/audit/` | Read-only SQL reports for comparing the live database with repository expectations. |
| `supabase/seed.sql` | Optional starter data. |

## Runtime Flow

1. `src/main.js` initializes the data store.
2. `src/supabaseStore.js` uses Supabase when configured and available.
3. Authentication state determines whether the sign-in or application shell is rendered.
4. Application state is rendered into `#app` using template functions.
5. Event listeners call workflow functions and persistence methods.
6. Successful writes update Supabase and then refresh or persist local state.

## UI Structure

The application uses view-level render functions rather than routes. Primary views include:

- My Profile
- Scheduler
- Vacation Requests
- People
- Hierarchy
- Departments
- Rotations
- Activity
- Settings

Right-side drawers handle focused tasks such as shift edits, daily bulk editing, request review, profile editing, department details, and rotation editing. Full employee profile and calendar experiences use the main content area.

## Scheduling Model

### Rotations

- Rotation patterns contain seven weekday slots.
- Allowed rotational states are Morning, Mid-day, Night, and Weekend.
- Every rotation version has an effective start date.
- The latest version effective on a requested date is used.

### Daily Overrides

- Overrides belong to one profile and one date.
- An override replaces the rotation-derived state for that date.
- Vacation, Sick, and On Ground are daily exceptions.
- Clearing an override returns the date to its rotation-derived state.
- Approved vacation requests may materialize vacation days into schedule rows for resolution, but the UI treats them as request-sourced vacation rather than manual overrides.

### Schedule Resolution

For a person and date:

1. Find a matching daily override.
2. Find the newest rotation version effective on that date.
3. Resolve the correct weekday slot.
4. Use the override when present; otherwise use the rotation result.
5. If no rotation exists, show Unassigned.

## Main Domain Data

- `profiles`: employee identity, role-related details, compatibility department anchor, leave balance, and optional auth link.
- `employee_profile_departments`: equal operational department memberships.
- `departments`: organizational grouping and minimum coverage target.
- `statuses`: schedule labels, kinds, and visual metadata.
- `rotation_versions`: versioned weekly schedule patterns.
- `schedule_overrides`: per-person, per-date schedule replacements, including manual daily changes and approved vacation request materializations.
- `vacation_requests`: request dates, status, decision data, and deducted days.
- `department_leads`: daily lead assignments.
- `department_lead_rotation_versions`: effective-dated Mon-Sun default lead patterns by department.
- `user_roles`: application access roles.

Employee profiles also carry `seniority_level`. Department lead scheduling uses department membership plus the weekly/daily lead assignment tables; any current department member can be selected as a day lead. `user_roles.lead` remains the separate authorization role for application permissions.
- `audit_log`: important operational changes.

## Authorization Model

- Admins can manage system settings, departments, profiles, and schedules.
- Department leads can manage permitted current/future data for their departments.
- Employees primarily view their own information and create allowed requests.
- Frontend permission helpers control affordances and visibility.
- Supabase RLS and RPC functions must enforce the actual security boundary.

## Visual Foundation

- Dark charcoal and black surfaces.
- Compact typography and restrained spacing.
- Red reserved for brand actions, selection, warnings, and destructive states.
- Shift-specific colors communicate schedule state.
- Unavailable states remain quieter than working states.
- Scheduler cells use the vertical bar as the primary working/non-working signal; individual status type is secondary through icon, label, and subtle texture.
- Scheduler filtering can narrow the current range by availability, rotational shift, daily exception, or manual change while keeping the date timeline visible.
- Cards are used for repeated entities and focused tools, not every page section.
- Icons and concise status tags carry repeated information.

## Persistence And Security

- Supabase Auth provides user sessions.
- Profiles may be created before auth users exist.
- A matching email can claim an unassigned profile.
- The browser uses the public Supabase anon key.
- RLS policies and RPC functions protect privileged operations.
- Service-role keys and private credentials must never enter the frontend repository.
- Unclaimed auth accounts must not receive operational read access.
- Internal `SECURITY DEFINER` helpers must not be directly executable unless they perform their own authorization checks.

## Runtime Configuration

Runtime environment values are not committed in frontend modules. `index.html` loads `runtime-config.js` before the application module and `src/config.js` reads `window.__SPORT360_CONFIG__`.

- Local development: `server.js` generates `/runtime-config.js` from ignored `.env.local`.
- Static builds: `scripts/build.js` writes `dist/runtime-config.js` from deployment environment variables.
- Netlify builds require `SPORT360_SUPABASE_URL` and `SPORT360_SUPABASE_ANON_KEY`.
- `SPORT360_ALLOW_SIGNUP=false` hides public account creation for the internal release.
- `SPORT360_RELEASE` identifies the deployed release; Netlify falls back to `COMMIT_REF`.

## Profile Photo Storage

- New profile images are stored in the private Supabase Storage bucket `profile-photos`.
- `employee_profiles.photo_url` stores a stable `storage:profile-photos/<profile-id>/<object>` reference rather than image bytes or a temporary URL.
- Claimed users receive short-lived signed read URLs when application state loads.
- Admins may write any profile folder; other users may write only the folder matching their claimed profile ID.
- Existing data URLs and external photo URLs remain readable as legacy fallback until each image is replaced.

## Known Architectural Limits

- `src/main.js` and `src/styles.css` are large and will eventually benefit from modularization.
- There is no automated browser test suite yet.
- Configuration is currently committed directly rather than injected per environment.
- Profile images need a fully verified Supabase Storage workflow.
- Migration application state must be reconciled before production release.
- Loading, offline, and recovery behavior need further hardening.

## Direction For Growth

Prefer incremental modularization over a framework rewrite. Extract a module only when a domain boundary is stable, such as scheduling, permissions, people, requests, or shared UI primitives. Preserve behavior and tests while moving code.
