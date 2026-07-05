# Production Rehearsal Report

This file records the Phase 4 backup, restore, health-check, monitoring, and rollback rehearsal. Complete it before the internal pilot starts.

Do not record database passwords, connection strings, access tokens, private employee data, or backup file contents here.

## Status

- Overall result: Pending
- Rehearsal date: Pending
- Operator: Pending
- Reviewer: Pending
- Release branch / commit: Pending

## Local Release Verification

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run phase4:local` passed | Pass | 2026-07-05 local run passed syntax, 7 unit tests, production build, and 13 demo smoke tests. |
| GitHub checks passed | Pending |  |
| Netlify deploy preview is healthy | Pending |  |

## Manual Export

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run backup:check` passed | Pending |  |
| `npm.cmd run backup:manual` completed | Pending |  |
| `npm.cmd run backup:verify` passed | Pending |  |
| Export folder stored outside repository | Pending |  |
| Off-site private copy created | Pending |  |
| Export folder label recorded in runbook migration log | Pending |  |

Backup folder label only:

```text
Pending
```

## Restore Rehearsal

Restore must happen in a non-production Supabase project.

| Check | Result | Notes |
| --- | --- | --- |
| Restore-test Supabase project created or selected | Pending |  |
| Manual export imported into restore-test project | Pending |  |
| Production migrations reconciled after restore | Pending |  |
| Restore-test runtime config created locally or in deploy preview | Pending |  |
| Profile photo storage behavior verified | Pending |  |
| Read-only Supabase audits passed | Pending |  |

Restore-test project label only:

```text
Pending
```

## Application Health Check

| Check | Chrome | Edge | Notes |
| --- | --- | --- | --- |
| Sign-in screen loads | Pending | Pending |  |
| Public account creation hidden | Pending | Pending |  |
| Admin can open Scheduler, People, Departments, Rotations, Requests, Activity, Settings | Pending | Pending |  |
| Department Lead can access allowed department workflows only | Pending | Pending |  |
| Employee can open My Profile and request vacation | Pending | Pending |  |
| Unmatched account cannot read operational data | Pending | Pending |  |
| No startup console errors | Pending | Pending |  |

## Data Health Check

| Check | Result | Notes |
| --- | --- | --- |
| Expected departments and sub-departments load | Pending |  |
| Pilot department people load correctly | Pending |  |
| Current-week rotations resolve | Pending |  |
| Vacation balances display | Pending |  |
| Daily lead assignments resolve | Pending |  |
| Activity log records a harmless test change | Pending |  |

## Rollback Rehearsal

| Check | Result | Notes |
| --- | --- | --- |
| Last known good Netlify deploy identified | Pending |  |
| Frontend rollback steps reviewed | Pending |  |
| Database rollback decision tree reviewed | Pending |  |
| Auth/access rollback path reviewed | Pending |  |
| Responsible owner and backup owner named | Pending |  |

## Issues Found

| Severity | Area | Description | Owner | Status |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |

## Signoff

The Phase 4 backup and restore gate can close only when:

- Manual export is verified.
- Restore rehearsal succeeds in a non-production Supabase project.
- Chrome and Edge health checks pass.
- Role checks pass for Admin, Department Lead, Employee, and unmatched accounts.
- Rollback ownership is known.
- No critical or high-severity issues remain open.

| Signoff | Name | Date | Notes |
| --- | --- | --- | --- |
| Operator | Pending | Pending |  |
| Reviewer | Pending | Pending |  |
