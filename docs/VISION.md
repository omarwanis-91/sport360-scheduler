# Product Vision

## Vision

Sport360 Scheduler should give teams one dependable place to understand who is working, who is unavailable, how departments are covered, and what schedule changes need attention.

The product should feel fast and calm under operational pressure. A manager should be able to scan a department, spot a coverage issue, make a daily change, and understand its impact without decoding a spreadsheet or moving between several tools.

## Core Goal

Build a dark, compact, Supabase-backed workforce scheduler that supports:

- Employee profiles that can exist before users create accounts.
- Secure profile claiming through a matching email address.
- Multiple departments with admins and department leads.
- Weekly rotation patterns with effective dates and preserved history.
- Daily schedule overrides and exceptions.
- Vacation requests, approval, balance deduction, and schedule impact.
- Personal and employee calendar views.
- Clear activity history for important operational changes.

## Primary Users

### Admin

Manages departments, people, roles, rotations, schedules, requests, statuses, and system-level settings.

### Department Lead

Manages current and future schedules, rotations, and requests for assigned departments.

### Employee

Views a personal schedule and profile, requests vacation, and understands upcoming work or approved exceptions.

## Product Principles

1. **Scan before reading.** Color, symbols, hierarchy, and spacing should reveal the state before detailed text is needed.
2. **Impact before confirmation.** Schedule and vacation changes should show coverage or balance consequences before saving.
3. **History must remain trustworthy.** Future rotation changes must not rewrite past schedules.
4. **Operational density without clutter.** The interface should use space efficiently while remaining calm and legible.
5. **One source of truth.** Production state belongs in Supabase, protected by RLS and server-authoritative functions where needed.
6. **Progressive detail.** Lists and drawers should stay concise; richer profile and calendar information belongs on dedicated views.

## In Scope

- Shift/status scheduling by label rather than precise clock-in hours.
- Department coverage targets and warnings.
- Versioned weekly rotations.
- Daily manual overrides and exceptions.
- Vacation balances and approval workflows.
- Profile, department, role, and membership management.
- Activity/audit visibility.
- Desktop-first responsive web UI.

## Out of Scope For Now

- Payroll, compensation, overtime, and invoicing.
- Accurate time tracking or attendance hardware.
- Complex labor-law calculations.
- Recruitment and applicant tracking.
- Full HR document management.
- Native mobile applications.

## Success Looks Like

- A manager can identify coverage risk in seconds.
- A daily schedule adjustment takes only a few deliberate clicks.
- Vacation approval clearly explains balance and coverage impact.
- Employees can understand a month of work and exceptions without visual noise.
- Important changes are attributable and reviewable.
- New contributors or agents can understand the project without relying on chat history.

