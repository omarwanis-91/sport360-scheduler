# Production Rehearsal Report

This file records the Phase 4 backup, restore, health-check, monitoring, and rollback rehearsal. Complete it before the internal pilot starts.

Do not record database passwords, connection strings, access tokens, private employee data, or backup file contents here.

## Status

- Overall result: Pending
- Rehearsal date: 2026-09-28
- Operator: Pending
- Reviewer: Pending
- Release branch / commit: `codex/phase4-ui-auth-hardening` / pending commit
- PR: Pending
- Production preview: https://sport360-scheduler.vercel.app
- Verified Vercel deployment: `dpl_5wUHmXHEfZC6S9Mg9uqxXeiFZjTY`

## Local Release Verification

| Check | Result | Notes |
| --- | --- | --- |
| Local validation passed | Pass | 2026-09-28 run passed syntax checks, 7 unit tests, production build, 15 application smoke tests, and 6 viewport tests. |
| GitHub checks passed | Pending | Run the new pull request checks after the Phase 4 branch is pushed. |
| Vercel production preview is healthy | Pass | Stable URL and the deployed HTML, recovery assets, and runtime configuration returned HTTP 200. Manual Chrome/Edge workflow verification remains pending. |

## Launch Gate Matrix

| Gate | Status | Notes |
| --- | --- | --- |
| Local release verification | Pass | Syntax, unit, build, app smoke, and viewport smoke checks passed on 2026-09-28. |
| GitHub PR checks | Pending | Requires the current branch pull request. |
| Vercel production preview status | Pass | `https://sport360-scheduler.vercel.app` is live with the expected Supabase runtime configuration. |
| Browser check of production preview | Pending | Verify the complete workflow manually in current Chrome and Edge. |
| Online internal preview | Pass | Vercel production preview is online; this does not close the backup/restore gate. |
| Migrations 022 and 023 applied | Pass | Applied in Supabase on 2026-09-28; live hierarchy and parent/sub-department lead workflows still require browser verification. |
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
| Employee can open My Profile and request annual leave | Pending | Pending |  |
| Unmatched account cannot read operational data | Pending | Pending |  |
| No startup console errors | Pending | Pending |  |

## Data Health Check

| Check | Result | Notes |
| --- | --- | --- |
| Expected departments and sub-departments load | Pending |  |
| Pilot department people load correctly | Pending |  |
| Current-week rotations resolve | Pending |  |
| Annual balances display | Pending |  |
| Daily lead assignments resolve | Pending |  |
| Activity log records a harmless test change | Pending |  |

## Rollback Rehearsal

| Check | Result | Notes |
| --- | --- | --- |
| Last known good Vercel deployment identified | Pending | Current deployment is recorded above; select and verify a previous rollback candidate before the pilot. |
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
