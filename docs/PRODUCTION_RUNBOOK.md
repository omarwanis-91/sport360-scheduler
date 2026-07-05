# Sport360 Production Runbook

This runbook records the operational steps for the internal Sport360 release. It complements `docs/ROADMAP.md`; it does not replace the phase acceptance gates.

## Account Onboarding

Production account creation is Admin-controlled. Public signup remains disabled through `SPORT360_ALLOW_SIGNUP=false`.

### Create An Employee Account

1. In Sport360 Scheduler, open **People** and create the employee profile first.
2. Use the employee's exact work email and assign the correct department. Leave the profile unclaimed.
3. In Supabase, open **Authentication → Users → Add user → Create new user**.
4. Create the Auth user with the exact email from the employee profile and a temporary password. Confirm the email only after verifying the address.
5. Give the temporary credentials to the employee through an approved private channel.
6. The employee signs in to Sport360 Scheduler. `claim_profile_for_current_user` links the Auth identity to the matching unclaimed profile and creates the baseline Employee role.
7. An Admin reopens the profile in **People** and assigns Lead or Admin only when that elevated role is required.

### Verify The Account

- The profile is marked claimed rather than unclaimed.
- The Auth user ID is linked to exactly one employee profile.
- The linked user has exactly one `user_roles` row.
- Employee navigation and write restrictions match the role audit matrix.
- Lead access is limited to the Lead's own department.

### Failure And Recovery

- **No matching profile:** verify the Auth email exactly matches an unclaimed employee profile email. Do not broaden read policies to work around a mismatch.
- **Wrong employee linked:** unlink the profile through the Admin UI, correct the profile email, and repeat sign-in. Do not manually reuse one Auth identity across profiles.
- **Wrong role:** correct the role from the claimed profile while signed in as Admin, then have the employee reload the application.
- **Lost password:** use Supabase Auth's password-recovery or Admin reset process. Never store or send passwords through the scheduler database.
- **Departed employee:** unlink or deactivate access before reassigning the profile or department membership.

## Runtime Configuration

Netlify provides:

- `SPORT360_SUPABASE_URL`
- `SPORT360_SUPABASE_ANON_KEY`
- `SPORT360_ALLOW_SIGNUP=false`

Local development uses the same variable names in ignored `.env.local`.

## Release Verification

- Open the deploy preview and confirm the sign-in page does not show **Create Account**.
- Sign in with one Admin, Lead, and Employee test account.
- Confirm an unmatched Auth account cannot read operational data.
- Confirm `runtime-config.js` identifies the expected Supabase project and has signup disabled.

## Production Release Checklist

Use this checklist before promoting an internal release.

1. Confirm the release branch is merged into `main`.
2. Confirm GitHub checks pass: static check, unit tests, build, and Chromium smoke tests.
3. Confirm Netlify production deploy uses the expected commit.
4. Confirm Netlify environment variables are present and production signup is disabled.
5. Run the latest Supabase audit SQL files that match the migrations being released.
6. On Supabase Free, create a fresh manual export and store it off-site. On paid plans, confirm the most recent managed backup is current.
7. Export critical operational tables before the release if a full logical dump is not available.
8. Verify Admin, Lead, Employee, and unmatched-account sign-in behavior.
9. Record the migration log entry for this release.
10. Keep rollback instructions open while the first production checks are performed.

## Backup And Export

Supabase is the source of truth. Netlify can be redeployed, but production data must be protected before migrations or risky operational changes.

### When To Back Up

- Before applying any Supabase migration.
- Before a production deploy that changes persistence or authorization behavior.
- Before importing, deleting, or bulk editing profiles, departments, rotations, requests, or schedule overrides.
- Before the one-department pilot starts.
- At the end of each pilot business day while the release is being monitored.

### Database Backup

Supabase managed daily backups are not available on the Free plan. Supabase documents daily managed backups for Pro, Team, and Enterprise projects, and recommends that Free plan projects regularly export data with `supabase db dump`.

Current release rule:

- **Free plan:** manual logical export is required before production release, migrations, bulk edits, and pilot start.
- **Paid plan:** managed backup is preferred, with manual export still useful before high-risk changes.

### Free Plan Manual Export

Use the Supabase CLI logical dump path when possible.

1. Install and sign in to the Supabase CLI on a trusted machine.
2. Get the production database connection string from Supabase **Project Settings -> Database -> Connection string**.
3. From the repository root, run `npm.cmd run backup:manual`.
4. Paste the database connection string when prompted. The input is hidden and is not written to disk.
5. Confirm the export folder was created outside the repository at `../sport360-backups/<timestamp>/`, unless `SPORT360_BACKUP_DIR` was set.
6. Confirm the folder contains `roles.sql`, `schema.sql`, `data.sql`, `migration_history_schema.sql`, `migration_history_data.sql`, and `manifest.json`.
7. Store the export in an approved off-site private location.
8. Record the export timestamp, release commit, storage location label, and operator in the migration log.
9. Do not commit exports, connection strings, database passwords, or generated dump files.

The helper follows the Supabase CLI backup sequence:

```powershell
npm.cmd run backup:manual
```

To choose a different output location:

```powershell
$env:SPORT360_BACKUP_DIR="D:\Sport360 Backups"
npm.cmd run backup:manual
```

For non-interactive use, set `SUPABASE_DB_URL` or `SPORT360_SUPABASE_DB_URL` only in a trusted local shell or secret manager:

```powershell
$env:SUPABASE_DB_URL="<production database connection string>"
npm.cmd run backup:manual
Remove-Item Env:\SUPABASE_DB_URL
```

Do not store the database connection string in `.env.local`, GitHub, Netlify, or the repository.

Manual Supabase CLI commands, if the helper is not used:

```powershell
supabase db dump --db-url "<connection string>" -f roles.sql --role-only
supabase db dump --db-url "<connection string>" -f schema.sql
supabase db dump --db-url "<connection string>" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "<connection string>" -f migration_history_schema.sql --schema supabase_migrations
supabase db dump --db-url "<connection string>" -f migration_history_data.sql --use-copy --data-only --schema supabase_migrations
```

Keep command history risk in mind if running manual commands. The helper is preferred because it avoids typing the connection string directly into the shell command.

Recommended folder naming:

```text
sport360-backups/YYYY-MM-DD_release-or-reason/
```

Recommended dump files:

```text
roles.sql
schema.sql
data.sql
```

If the CLI path is not available, use Supabase Table Editor exports for the critical tables below. This is weaker than a full logical dump, but still better than moving without a recovery point:

- `departments`
- `employee_profiles`
- `employee_profile_departments`
- `user_roles`
- `shift_statuses`
- `rotation_versions`
- `department_lead_rotation_versions`
- `department_daily_leads`
- `schedule_overrides`
- `vacation_requests`
- `audit_log`

Keep exports outside the repository. They may contain private employee data and must not be committed.

### Paid Plan Managed Backup

Use this path only if the production Supabase project has managed backups available.

1. Open Supabase.
2. Select the production project.
3. Open **Database -> Backups**.
4. Confirm a recent backup exists.
5. If the plan supports manual backups, create one before applying changes.
6. Record the backup timestamp, release commit, and operator in the migration log section below.

### Storage Backup

The `profile-photos` bucket is private and contains employee profile images.

1. Open Supabase **Storage -> profile-photos**.
2. Confirm the bucket remains private.
3. Before a major profile-photo migration, download the affected folders or confirm the bucket is included in the project backup plan.
4. Record the storage backup status in the migration log.

## Restore Rehearsal

A backup is not production-ready until restore has been rehearsed.

Perform the rehearsal in a non-production Supabase project, never in the production project.

1. Create or choose a temporary restore-test Supabase project.
2. Restore the selected managed backup or import the manual export into the restore-test project.
3. Apply the same migrations that production is expected to run.
4. Configure a local `.env.local` or Netlify deploy preview to point at the restore-test project.
5. Sign in with test Admin, Lead, and Employee accounts.
6. Confirm the app can load Scheduler, People, Departments, Rotations, Requests, and My Profile.
7. Confirm profile photos either load through signed URLs or fall back safely.
8. Run the matching read-only audit SQL files from `supabase/audit/`.
9. Record the rehearsal result, restore source, and any gaps in the migration log.

The Phase 4 release gate is not complete until a restore rehearsal succeeds. On Supabase Free, that means restoring from the manual export, not from the unavailable managed-backup dashboard.

## Migration Log

Record each production database change here or in a linked issue/PR before release. Keep credentials and private data out of the log.

| Date | Release / Commit | Migration or Action | Backup Timestamp | Audit / Verification | Operator | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Pending | Pending | Free-plan manual export and restore rehearsal | Pending | Pending | Pending | Pending |

For each applied migration, record:

- The migration filename.
- Whether it was applied through Supabase SQL Editor, CLI, or another controlled process.
- The exact audit SQL file run afterward.
- Whether any manual recovery step was needed.
- Whether recovery depends on a Free-plan manual export or a managed paid-plan backup.

## Health Check

Run this after every production deploy and after every database migration.

### Browser Checks

1. Open the production URL in Chrome.
2. Open the production URL in Edge.
3. Confirm the sign-in screen loads.
4. Confirm **Create Account** is hidden when `allowSignup` is false.
5. Sign in as Admin and open Scheduler, People, Departments, Rotations, Requests, Activity, and Settings.
6. Sign in as a Department Lead and confirm the Lead sees only allowed department workflows.
7. Sign in as an Employee and confirm personal profile and vacation request flows work.
8. Sign in with an unmatched test account and confirm operational data is blocked.

### Data Checks

1. Confirm the expected departments and sub-departments load.
2. Confirm the selected pilot department has the expected people.
3. Confirm rotations resolve for the current week.
4. Confirm vacation balances display for at least one pilot employee.
5. Confirm a profile photo loads from `profile-photos` or falls back cleanly.
6. Confirm the Activity view records a harmless test change, then reverse the change if needed.

### Technical Checks

1. Open browser devtools and confirm there are no startup console errors.
2. Confirm `runtime-config.js` points to the production Supabase URL and expected release value.
3. Confirm network calls to Supabase return successful responses for the signed-in role.
4. Confirm Netlify deploy logs show a successful build.
5. Run `npm.cmd run check`, `npm.cmd test`, and demo smoke tests locally before merging the release branch.

## Monitoring During Pilot

During the five-business-day pilot, check these at the start and end of each business day.

- Netlify deploy status and error logs.
- Supabase API/database health.
- Supabase Auth user issues.
- Failed or unusual schedule, vacation, profile, and rotation writes.
- `audit_log` entries for unexpected Admin or Lead changes.
- Pilot department feedback: missing shifts, wrong leads, confusing vacation status, or blocked actions.

Capture issues with:

- Date and time.
- Signed-in role.
- Department.
- Browser.
- Steps that caused the issue.
- Screenshot when useful.
- Whether data was changed.

Critical or high-severity issues pause rollout beyond the pilot department.

## Rollback

Rollback should restore a usable production state quickly while preserving data.

### Frontend Rollback

Use this when the issue is visual, navigation-related, runtime-config-related, or isolated to frontend behavior.

1. Open Netlify **Deploys**.
2. Select the last known good production deploy.
3. Use **Publish deploy** to roll back the frontend.
4. Confirm the production URL loads.
5. Run the health check again.
6. Record the rollback in the migration log.

### Database Rollback

Database rollback is higher risk because production data may have changed after migration.

1. Stop new production use if data integrity is at risk.
2. Identify the migration or manual change that introduced the issue.
3. Prefer a forward fix migration when possible.
4. If restore is required, restore into a non-production project first and verify the result.
5. Decide whether to restore production from backup only after confirming the data-loss window and business impact.
6. Record the decision, backup timestamp, affected data window, and verifier.

Do not run destructive rollback SQL from memory. Use reviewed SQL, a backup, and a second human check.

### Auth Or Access Rollback

Use this when users cannot sign in or roles are wrong.

1. Confirm Supabase Auth health.
2. Confirm `user_roles` and profile claim state for one affected user.
3. Re-run the role read/write audits when policies or RPCs are involved.
4. Revert frontend deploy only if the issue came from UI/runtime configuration.
5. Use a forward database fix for policy or RPC mistakes.

## Emergency Contacts And Ownership

Fill this before pilot launch.

| Area | Owner | Backup Owner | Where To Check |
| --- | --- | --- | --- |
| Netlify deploys | Pending | Pending | Netlify project deploys |
| Supabase database | Pending | Pending | Supabase database dashboard |
| Supabase Auth | Pending | Pending | Supabase Authentication |
| Pilot department signoff | Pending | Pending | Pilot feedback log |
| Incident decisions | Pending | Pending | Release issue or PR |
