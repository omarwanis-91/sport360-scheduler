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
