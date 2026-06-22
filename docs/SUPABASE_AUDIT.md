# Supabase Audit

## Audit Status

Static migration review and the consolidated live baseline audit were completed on 2026-06-20.

The live audit passed for:

- All nine expected application tables.
- RLS enabled on every application table.
- The department coverage target column.
- Nullable profile department membership.
- Every expected pre-hardening RPC.

The baseline audit confirmed both expected security risks: direct browser execution of `apply_vacation_overrides` and the legacy broad-read profile policy.

Migration `011_harden_claimed_user_access.sql` was applied on 2026-06-20. The post-migration audit passed every reported table, column, function, RLS, and security check. Direct browser execution of the internal helper is revoked, and the legacy broad-read profile policy is absent.

Run `supabase/audit/001_live_schema_audit.sql` in the Supabase SQL editor. It is read-only and ends with one consolidated result grid covering tables, RLS, required columns, routines, and the two identified security risks.

## Static Findings

### Critical - Direct Vacation Override Function Access

`apply_vacation_overrides` is a `SECURITY DEFINER` function. Migration `004_harden_role_rls.sql` grants it directly to `authenticated`, but the function itself does not perform a role or ownership check. A signed-in user could call it directly and bypass schedule-write RLS.

Migration `011_harden_claimed_user_access.sql` revokes direct execution. Vacation overrides remain available through `decide_vacation_request`, which performs Admin/Lead authorization and balance checks.

### High - Unclaimed Accounts Receive Broad Read Access

The original claim function creates an Employee role even when no employee profile matches the signed-in email. Existing read policies allow all authenticated users to view profiles and schedules.

Migration `011_harden_claimed_user_access.sql` changes claiming so an unmatched account receives an error and no role. Broad operational reads now require an auth account linked to an employee profile.

### Verified - Live Baseline Migration State

The repository previously contained a different migration sequence, and some SQL was applied manually. The consolidated audit confirms that the current live objects required before migration `011` are present and RLS-enabled.

## Post-Migration Result

- All expected tables and pre-hardening functions are present.
- RLS is enabled on every application table.
- Required coverage and unassigned-profile columns pass.
- `apply_vacation_overrides` is not browser-executable.
- The legacy broad-read profile policy is absent.
- Role-by-role workflow testing remains pending.

## Role Test Matrix

| Workflow | Admin | Department Lead | Employee |
| --- | --- | --- | --- |
| Read claimed application data | Allow | Allow | Allow |
| Manage departments/statuses/roles | Allow | Deny | Deny |
| Manage profiles | Allow | Deny | Deny |
| Edit current/future own-department schedule | Allow | Allow | Deny |
| Edit past schedule | Allow | Deny | Deny |
| Manage own-department future rotations | Allow | Allow | Deny |
| Request own vacation | Allow | Allow | Allow |
| Decide own-department requests | Allow | Allow | Deny |
| Read audit log | Allow | Deny | Deny |
| Update own name/photo | Allow | Allow | Allow |

`supabase/audit/002_role_read_audit.sql` performs the read-access portion of this matrix using temporary tables and simulated JWT subjects. It makes no application-data changes. Write behavior still requires controlled UI or API tests with dedicated accounts.

`supabase/audit/003_role_write_audit.sql` performs rollback-safe write checks. Each successful DML statement is deliberately rolled back inside a PL/pgSQL subtransaction, while denied statements are checked by affected-row count or expected SQLSTATE.

### Write Audit Result - 2026-06-21

All 17 controlled write checks passed:

- Admin can manage departments, profiles, statuses, and past schedule corrections.
- Department Leads can create future rotations and overrides in their own department.
- Department Leads cannot manage departments, edit past schedules/rotations, or edit other departments.
- Employees can create their own vacation requests and update their own profile through the authorized RPC.
- Employees cannot directly edit profiles, departments, schedules, or other profiles' vacation data.

Every successful test write was rolled back inside its test subtransaction. No audit fixture rows were retained.

### UI Regression Result - 2026-06-21

A temporary demo-mode build was tested in the browser for all three roles. No console warnings or errors were reported.

Admin checks passed:

- New Profile, New Department, New Rotation, New Request, and New Status actions are available.
- Shift override controls and date ranges are enabled.
- Personal profile editing is available.

Department Lead checks passed:

- Profile, department, and status creation actions are hidden.
- Rotation and vacation-request actions are available.
- Current/future shift editing is enabled inside the Lead's department.
- Shift editing is disabled after switching to another department.
- Personal profile editing remains available.

Employee checks passed:

- Profile, department, rotation, and status management actions are hidden.
- Shift override controls and date ranges are disabled.
- Vacation request creation is available only for the signed-in Employee profile.
- Personal profile editing allows name/photo self-service while email, title, department, balances, and role remain Admin-controlled.

### Read Audit Result - 2026-06-20

- Admin identity and application reads: pass.
- Unmatched authenticated account isolation: pass.
- Department Lead identity and restricted reads: pass.
- Employee identity and restricted reads: pass.

Verified restrictions include:

- Lead and Employee accounts can see only their own role row.
- Lead and Employee accounts cannot read the audit log.
- Leads cannot read vacation requests outside their department.
- Employees cannot read vacation requests for other profiles.
- Unmatched authenticated accounts cannot read profiles, departments, statuses, rotations, overrides, or daily leads.

## Next Action

Run `supabase/audit/004_department_rotation_batch_audit.sql` after migration `012`. It verifies history preservation, valid Admin/Lead saves, invalid-status rejection, atomic failure, past-date restrictions, cross-department restrictions, and Employee denial. Every successful test write is rolled back.

### Department Rotation Batch Audit Result - 2026-06-21

All eight checks passed:

- Existing rotation history remained unchanged while new effective-dated versions were created.
- Invalid rotational statuses were rejected.
- Mixed-department failure was atomic and retained no rows.
- Admin batch saves, Lead future own-department saves, and Employee denial behaved as designed.
- Lead past-date and cross-department batch saves were rejected.

Repeat the broader role regression after any material permission, navigation, profile, schedule, rotation, or request workflow change.
