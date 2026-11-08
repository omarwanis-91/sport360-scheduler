# Automatic Annual Renewal

## Behavior

Each January 1 in Africa/Cairo, the Annual budget renews from the person's saved allowance. Unused days do not carry over. An allowance of 15 with 5 remaining becomes 15 available in the new year, while the old year's 5/15 record remains stored. Already approved new-year days stay reserved: two booked days means 13/15 available after renewal.

Requests, scheduled Annual/Sick/On Ground days, rotations, identities, memberships and permissions are retained. Renewal writes a system Activity entry; manual Admin balance adjustments record their previous and new values. Changing allowance updates advance-year entitlements without rewriting archived years. Approval splits cross-year dates and commits deductions, request status and overrides together or rolls everything back.

Existing current balances are preserved during installation. The migration starts yearly tracking in the current Cairo year. Identifiable legacy approved future Annual dates are reserved in their actual year; current manually entered remainders are not automatically refunded or reconstructed. Unknown earlier-year balances are not invented.

## Activate in production

1. Use a reviewed backup and the existing Supabase SQL Editor workflow. Apply `supabase/migrations/033_annual_year_rollover.sql` as the project database owner before deploying the matching client. It is one transaction, including the Cron setup. If preflight reports future Annual without an approved source or bookings exceeding allowance, review those records; do not bypass the guard or fabricate replacements.
2. Run `supabase/audit/021_annual_year_rollover_audit.sql`. All five checks must be true, including balance/profile agreement, scoped read-only ledger access, private reset helpers, stale-edit protection and the active Cairo renewal job.
3. In Supabase Integrations → Cron, verify `sport360-annual-year-rollover` is active, scheduled `0 * * * *`, with command `select public.rollover_annual_balances();`. The migration enables `pg_cron` if necessary. Inspect the next run's History for success, or use Run now with the unchanged command: profiles already in the current year are not reset again. [Supabase Cron setup](https://supabase.com/docs/guides/cron/install), [job management and history](https://supabase.com/docs/guides/cron/quickstart).
4. Deploy the reviewed client to Vercel and Netlify. The updated app requires the new refresh and guarded profile-save RPCs; do not deploy before the migration passes.
5. As Admin, open Team → person → Edit Profile. Confirm the displayed balance year and existing allowance/remainder. A normal manual adjustment should persist after reload without adding Annual requests or calendar days. Inspect a pending December/January request: its impact shows each year's budget separately. Role Preview remains read-only.

The hourly job reaches Cairo midnight on January 1 and retries missed work; ordinary runs in the same year change nothing. The app refreshes due balances before loading data, and an already open app detects a year change. A drawer is not overwritten while being edited; a stale balance save is rejected with a refresh message. No browser caller can supply a future date to force renewal.

A paused/offline database cannot execute scheduled jobs. After resumption, the next scheduled run or authenticated app load catches up without erasing older records, including intermediate years. Do not simulate January 1 by changing live balances, the production clock, or the protected helper functions; use the isolated tests instead.

## Read historical balances

Admin may inspect records in the SQL Editor without changing them:

```sql
select p.full_name, b.balance_year, b.allowance_days, b.remaining_days, b.source
from public.annual_balance_years b
join public.employee_profiles p on p.id = b.profile_id
order by p.full_name, b.balance_year desc;
```

The application retains all previous Annual requests and schedule records. New approved requests also retain `deducted_days_by_year`, so later rotation edits do not rewrite their recorded deductions. The historical balance reflects deliberate later adjustments/late approvals for that year, not a reconstructed attendance ledger.

## Local validation

- `npm.cmd test`: Cairo midnight, opening balances, no carryover, advance reservations, skipped years, allowance changes, zero entitlement and atomic rejection.
- `npm.cmd run test:annual-db`: pinned, isolated PostgreSQL tests of migration 033, applicable audit checks, real approval/profile RPCs, RLS/grants, stale updates and transaction rollback. No production connection or credentials. The engine does not install `pg_cron`; live audit 021 verifies actual Cron activation.
- `npm.cmd run check`, `npm.cmd run build`, `npm.cmd run test:smoke -- --workers=2`: existing workflows plus simulated New Year, stale profile forms, year-split previews and remote save contracts.

Disabling the named job stops unattended renewal but does not remove balances/history; startup catch-up still operates. Do not drop the ledger or roll back to the old balance-writing client after activation. If a release needs rollback, retain the migration and protect the year-aware write contract while reviewing the issue.
