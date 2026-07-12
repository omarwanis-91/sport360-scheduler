# Production Rehearsal Report

This file records the Phase 4 backup, restore, health-check, monitoring, and rollback rehearsal. Complete it before the internal pilot starts.

Do not record database passwords, connection strings, access tokens, private employee data, or backup file contents here.

## Status

- Overall result: Pending
- Rehearsal date: 2026-07-12
- Operator: Pending
- Reviewer: Pending
- Release branch / commit: Pending
- PR: https://github.com/omarwanis-91/sport360-scheduler/pull/7
- Deploy preview: https://deploy-preview-7--sport360scheduler.netlify.app

## Local Release Verification

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run phase4:local` passed | Pass | 2026-07-05 local run passed syntax, 7 unit tests, production build, and 13 demo smoke tests. |
| GitHub checks passed | Pass | PR #7 is clean; `verify` passed; Netlify redirect/deploy-preview checks passed. |
| Netlify deploy preview is healthy | Partial | GitHub/Netlify status reports deploy preview ready. Direct local shell HTTP checks and in-app browser navigation timed out; still needs manual Chrome/Edge confirmation. |

## Launch Gate Matrix

| Gate | Status | Notes |
| --- | --- | --- |
| Local release verification | Pass | `npm.cmd run phase4:local` passed on 2026-07-05. |
| GitHub PR checks | Pass | PR #7 checks are passing and merge state is clean. |
| Netlify deploy preview status | Pass | Netlify status context is passing for PR #7. |
| Browser check of deploy preview | Pending | Local shell HTTP and in-app browser navigation timed out; verify manually in Chrome/Edge or through Netlify browser session. |
| Online internal preview | In progress | Proceeding through the connected static host before closing the full backup/restore gate. |
| Free-plan manual export | Blocked | Supabase CLI reached the remote database but local Docker/WSL is unavailable; Docker reports WSL2 is not supported with the current machine configuration. |
| Backup folder verification | Pending | Run `npm.cmd run backup:verify` after export. |
| Restore rehearsal | Pending | Requires non-production Supabase restore-test project. |
| Live role/auth checks | Pending | Must verify Admin, Department Lead, Employee, and unmatched account behavior against restored or production-like environment. |
| Rollback owner/signoff | Pending | Fill ownership rows before pilot. |
| Pilot department signoff | Pending | Requires five business days of monitored use. |

## Manual Export

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd run backup:check` passed | Pending |  |
| `npm.cmd run backup:manual` completed | Blocked | Connection string was accepted, but Supabase CLI dump requires local Docker/WSL. Use dashboard CSV export as temporary preview-only fallback until Docker/WSL is repaired. |
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
| Medium | Backup | Full SQL export is blocked by local Docker/WSL. Online preview may proceed, but production-ready release cannot close until export and restore rehearsal pass. | Pending | Open |

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
