# Supabase Audit

## Audit Status

Static migration review and the consolidated live baseline audit were completed on 2026-06-20.

The live audit passed for:

- All nine expected application tables.
- RLS enabled on every application table.
- The department coverage target column.
- Nullable profile department membership.
- Every expected pre-hardening RPC.

The audit confirmed both expected security risks: direct browser execution of `apply_vacation_overrides` and the legacy broad-read profile policy. The live schema is ready for migration `011_harden_claimed_user_access.sql`.

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

## Post-Migration Checks

- Confirm `is_claimed_user` is present.
- Confirm `apply_vacation_overrides` is not executable by `PUBLIC`, `anon`, or `authenticated` after migration `011`.
- Confirm unmatched signups cannot read profiles or schedules.
- Test Admin, Lead, and Employee behavior using separate accounts.

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

## Next Action

1. Apply `011_harden_claimed_user_access.sql` in Supabase.
2. Rerun the read-only audit SQL; every row should report `pass`.
3. Execute the role test matrix with separate accounts.
