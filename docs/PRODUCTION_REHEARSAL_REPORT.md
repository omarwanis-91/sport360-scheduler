# Production Rehearsal Report

This file records the Phase 4 backup, restore, health-check, monitoring, and rollback rehearsal. Complete it before the internal pilot starts.

Do not record database passwords, connection strings, access tokens, private employee data, or backup file contents here.

## Status

- Overall result: Pending
- Rehearsal date: 2026-10-03 to 2026-10-04
- Operator: Omar Wanis / Codex
- Reviewer: Pending
- Release branch / commit: `codex/phase4-live-verification` / `0fa037b`
- PR: https://github.com/omarwanis-91/sport360-scheduler/pull/11
- Production preview: https://sport360-scheduler.vercel.app
- Verified Vercel deployment: `dpl_5wUHmXHEfZC6S9Mg9uqxXeiFZjTY`

## Local Release Verification

| Check | Result | Notes |
| --- | --- | --- |
| Local validation passed | Pass with cleanup note | 2026-10-03 syntax checks, 7 unit tests, production build, 15 application smoke tests, and 6 viewport tests passed. All 21 Playwright cases completed successfully; the local wrapper did not exit after Playwright cleanup and was stopped manually. |
| GitHub checks passed | Pass | PR #11 run `37141235283` passed, including GitHub verification, Vercel, Netlify deploy preview, and Netlify redirect checks. |
| Vercel production preview is healthy | Pass | Stable URL and the deployed HTML, recovery assets, and runtime configuration returned HTTP 200. Admin production checks pass in Chrome, Edge, and Firefox. |

## Launch Gate Matrix

| Gate | Status | Notes |
| --- | --- | --- |
| Local release verification | Pass | Syntax, unit, build, app smoke, and viewport smoke checks passed on 2026-09-28. |
| GitHub PR checks | Pass | PR #11 checks passed for commit `0fa037b`. |
| Vercel production preview status | Pass | `https://sport360-scheduler.vercel.app` is live with the expected Supabase runtime configuration. |
| Browser check of production preview | Partial pass | Admin read-only coverage passes in Chrome, Edge, and Firefox. Department Lead, Employee, and unmatched-account checks remain pending. |
| Online internal preview | Pass | Vercel production preview is online; this does not close the backup/restore gate. |
| Migrations 022 and 023 applied | Pass | Live Manager, Lead, and Artist saves pass. The sub-department lead round trip passes and restores cleanly. |
| Migration 024 applied and audited | Pass with cleanup note | Migration 024 was applied through the Supabase SQL Editor. Audit 012 returned three passes and the live parent assignment write succeeded. The temporary row was removed with an exact guarded query and a follow-up count returned zero. The Scheduler UI still needs a parent-override cleanup path. |
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

| Check | Chrome | Edge | Firefox | Notes |
| --- | --- | --- | --- | --- |
| Sign-in screen loads | Pass | Pass | Pass | Chrome automated; Edge and Firefox confirmed manually. |
| Public account creation hidden | Pass | Pass | Pass | Production signup is hidden. |
| Admin can open Scheduler, People, Departments, Rotations, Requests, Activity, Settings | Pass | Pass | Pass | Chrome exercised every navigation target; Edge and Firefox parity confirmed manually. |
| Department Lead can access allowed department workflows only | Pending | Pending | Pending | Requires a claimed Department Lead account. |
| Employee can open My Profile and request annual leave | Pending | Pending | Pending | Requires a claimed Employee account. |
| Unmatched account cannot read operational data | Pending | Pending | Pending | Requires an unmatched test account. |
| No startup console errors | Pass | Pass | Pass | Chrome console was empty; Edge and Firefox confirmed manually. |

## Data Health Check

| Check | Result | Notes |
| --- | --- | --- |
| Expected departments and sub-departments load | Pass | Video Unit, Video Edit, and Motion Graphics load with the expected hierarchy. |
| Pilot department people load correctly | Pass | Video Edit loads eight profiles; Video Unit loads twelve scoped profiles. |
| Current-week rotations resolve | Pass | Current schedule resolves weekly shifts and lead names. |
| Annual balances display | Pass | Profile balances and approved requests load in production. |
| Daily lead assignments resolve | Partial pass | Sub-department assignment saves and restores. After migration 024, the parent assignment saves successfully and production returns to the original schedule after guarded SQL cleanup. The Scheduler cannot yet remove a stored parent override through its own lead drawer. |
| Activity log records a harmless test change | Pass | Unchanged Manager, Lead, and Artist saves plus the restored sub-department lead check appear in Activity. |

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
| High | Parent department validator | The retired direct-membership validator rejected child-department members offered by the parent Scheduler. Migration 024 replaced both validators; audit 012 passed and the live parent write succeeded. | Omar Wanis | Resolved 2026-10-03 |
| Medium | Parent lead override cleanup | A parent-department daily override can be saved, but the aggregate parent Scheduler resolves its lead drawer to a child department and cannot return the stored parent row to weekly rotation. The verification row required an exact guarded SQL cleanup, which was confirmed by a zero-row follow-up count. | Pending | Open |
| Medium | Backup | Full SQL export is blocked by local Docker/WSL. Online preview may proceed, but production-ready release cannot close until export and restore rehearsal pass. | Pending | Open |

## Signoff

The Phase 4 backup and restore gate can close only when:

- Manual export is verified.
- Restore rehearsal succeeds in a non-production Supabase project.
- Chrome, Edge, and Firefox health checks pass.
- Role checks pass for Admin, Department Lead, Employee, and unmatched accounts.
- Rollback ownership is known.
- No critical or high-severity issues remain open.

| Signoff | Name | Date | Notes |
| --- | --- | --- | --- |
| Operator | Pending | Pending |  |
| Reviewer | Pending | Pending |  |
