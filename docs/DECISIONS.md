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
**Status:** Accepted

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
