# Production Rehearsal Report

This file records the Phase 4 backup, restore, health-check, monitoring, and rollback rehearsal. Complete it before the internal pilot starts.

Do not record database passwords, connection strings, access tokens, private employee data, or backup file contents here.

## Status

- Overall result: Pending
- Rehearsal date: 2026-10-03
- Operator: Omar Wanis / Codex
- Reviewer: Pending
- Release branch / commit: `codex/phase4-live-verification` / pending commit
- PR: Pending
- Production preview: https://sport360-scheduler.vercel.app
- Verified Vercel deployment: `dpl_5wUHmXHEfZC6S9Mg9uqxXeiFZjTY`

## Local Release Verification

| Check | Result | Notes |
| --- | --- | --- |
| Local validation passed | Pass with cleanup note | 2026-10-03 syntax checks, 7 unit tests, production build, 15 application smoke tests, and 6 viewport tests passed. All 21 Playwright cases completed successfully; the local wrapper did not exit after Playwright cleanup and was stopped manually. |
| GitHub checks passed | Pass | Main run `37114013068` passed before this verification branch. The new pull request checks remain required. |
| Vercel production preview is healthy | Pass | Stable URL and the deployed HTML, recovery assets, and runtime configuration returned HTTP 200. Admin production checks pass in Chrome, Edge, and Firefox. |

## Launch Gate Matrix

| Gate | Status | Notes |
| --- | --- | --- |
| Local release verification | Pass | Syntax, unit, build, app smoke, and viewport smoke checks passed on 2026-09-28. |
| GitHub PR checks | Pending | Requires the current branch pull request. |
| Vercel production preview status | Pass | `https://sport360-scheduler.vercel.app` is live with the expected Supabase runtime configuration. |
| Browser check of production preview | Partial pass | Admin read-only coverage passes in Chrome, Edge, and Firefox. Department Lead, Employee, and unmatched-account checks remain pending. |
| Online internal preview | Pass | Vercel production preview is online; this does not close the backup/restore gate. |
| Migrations 022 and 023 applied | Pass | Live Manager, Lead, and Artist saves pass. The sub-department lead round trip passes and restores cleanly. Parent assignment is blocked by the stale trigger validator; migration 024 is prepared. |
| Migration 024 applied and audited | Pending | Apply `024_fix_parent_department_lead_validation.sql`, run audit 012, and repeat the live parent assignment check. |
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
| Daily lead assignments resolve | Partial pass | Sub-department assignment saves and restores. Parent assignment is rejected until migration 024 replaces the stale validator. |
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
| High | Parent department leads | Production still executes the retired direct-membership/lead-eligibility trigger, rejecting a child-department member offered by the parent Scheduler. Migration 024 replaces daily and weekly validators with descendant-aware scope checks. | Omar Wanis | Fix prepared; apply and retest |
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
