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

## Next Action

1. Run `supabase/audit/002_role_read_audit.sql` in the Supabase SQL editor.
2. Resolve any `fail` results. A `skip` means no linked account exists for that role.
3. Complete controlled write tests with dedicated Admin, Department Lead, and Employee accounts.
