# Opening Balances and Historical Data Entry

## Current plan: November onward, manual opening balances

Do not reconstruct schedules or create Annual requests for dates before November 2026. Use the existing Admin balance fields instead:

1. Open Team, select the employee, and choose Edit Profile.
2. Set Annual allowance to the recurring entitlement, for example `15`.
3. Set Annual days left to the actual current remainder, for example `5`.
4. Save Profile and reopen it to verify `5 / 15`.

This sets the balance directly. It does not create ten past Annual days, requests, or daily overrides, and it does not change rotations. The allowance persists until edited; the current balance is independently editable by Admin. Approved Annual requests charge eligible days to the year of each leave date.

Record the date represented by the opening balance. Leave already accounted for in that balance must not be approved again as historical requests. After migration 033/audit 021 and deployment, January 1 renews the budget from the saved allowance without carryover and keeps each previous year separately. Approved next-year days remain reserved: allowance 15 with two booked days opens with 13 available. See `docs/ANNUAL_RENEWAL.md` for activation and verification.

The historical-entry procedure below is optional reference for a later explicit change of plan; it is not the current setup task.

Use the existing Admin workflows for a small, reviewed backfill. This guide does not run an import. There is currently no bulk importer or historical request-timestamp editor. Per-year balances begin with the migration's opening year; earlier entitlement/balances are not inferred.

## 1. Resolve people and scope

- Pick the date range and leave year to bring into the app. List one canonical employee profile ID for each person, with their department and linked account.
- Reconcile same-name unassigned signup profiles with operational profiles before entering history. `Pending assignment` is an onboarding job-title placeholder, not a leave request. Do not delete a duplicate or move an account until its existing schedules, requests, and references have been reviewed.
- Prepare source records: person, date or date range, shift/status, reason, and original approval reference where applicable. Split ranges when statuses change. Use calendar dates in `YYYY-MM-DD` format.
- Agree which source is authoritative if a person is marked Sick, On Ground, and Annual on the same date. The app supports one daily override per person/date; a later edit can replace an earlier one.

## 2. Back up and establish the opening balance

- Take a current Supabase export and verify restoration in a non-production project before a large production import. Follow `docs/PRODUCTION_RUNBOOK.md`. The living roadmap still records the full SQL export/restore gate as open; dashboard CSVs are a preview fallback, not a verified full restore.
- Record each person's current Annual allowance, balance, existing approved requests, and any existing daily overrides in the import range. Pause overlapping edits during the controlled entry window.
- Verify migration `028_harden_annual_eligibility.sql` with audit `supabase/audit/016_annual_eligibility_audit.sql` before relying on duplicate/overlap protection. Its application is not yet confirmed in the living TODO.
- After migration 033, approved Annual deducts from each affected year's ledger. Do not start with a remainder that already deducts the same historical leave and then approve it again. Before migration 033 is activated, the legacy approval workflow deducts everything from the one current balance.
- For a fresh, single-year setup, enter the agreed opening balance *before* the leave being imported. Example: opening balance 21, eligible imported Annual 5, expected balance afterward 16. Use Team → Directory → employee → Edit Profile → Annual days left, as Admin. Keep the allowance consistent with the person's actual entitlement.
- If balances already reflect imported dates, or history predates yearly tracking, first prepare a reviewed reconciliation with the expected closing balance. Do not invent earlier years' entitlements or temporarily add extra allowance. A controlled historical import/balance adjustment may be needed beyond the current UI.

## 3. Enter rotation history first

1. Sign in as Admin; Leads cannot backdate schedule changes.
2. Open Rotations and select the department. Start with the oldest required effective date and work forward through the actual pattern changes.
3. Click a person's rotation, set the seven weekday shifts and any explicit Lead days, and use Done. Set a personal date only when that person differs from the page date.
4. Review changed-person markers and click Save Changes. Only changed people are saved.
5. When later versions exist, choose **Keep later versions** for a history-only insertion. **Apply from these dates onward** deliberately replaces later plans for edited people; use it only when that is the intended correction.
6. Check dates immediately before and after each boundary, including where the current schedule resumes. If a historical pattern ends before an existing later version, add the correct restoring version at that endpoint too. An effective start has no automatic end date.

Existing daily overrides take precedence over rotations. A pattern change therefore may not visibly change a date that already has an exception.

## 4. Enter daily exceptions

In Scheduler, choose the historical start date and click the person's day. Select the actual one-time shift, Sick, or On Ground; review Apply from / Apply to; add the source reference in Note; then Save Daily Change.

- Use small, exact ranges; do not paint across existing Annual or other exceptions without reviewing the conflict.
- Sick and On Ground do not deduct the Annual balance.
- Clear Override restores that date's effective rotation; it does not restore a previously overwritten override. Recover an accidentally replaced exception from the source record/backup.
- Do not use Clear Override or a manual shift edit to cancel approved Annual: that does not refund its balance or reconcile its request. Annual cancellation is still a future workflow.

## 5. Enter Annual through requests

Use Requests → New Request, choose the correct employee, enter the historical dates, and record the original approval/source reference in Reason. Submit and review the request, inspect the team-impact preview and eligible-day count, then Approve once.

With migration 028 verified, Weekend, Sick, and already-Annual dates are excluded from new deductions. Working On Ground dates can still be eligible, so resolve conflicting source records before approving. A request can cover a date range while deducting only its eligible workdays.

Do not insert Annual overrides directly or create approved request rows by hand. Approval is the existing transaction that links the request, schedule overrides, and balance deduction. Already imported/approved leave must not be submitted again. Audit/request creation times record when data was entered; original historical submission/approval times belong in the source notes unless a dedicated importer is built.

## 6. Pilot and reconcile

Start with one person and one week. Verify:

- Every day matches the source, including weekends, Lead shifts, and exceptions.
- The current/future rotation remains correct after the historical interval.
- Annual deductions match distinct eligible days and the recorded opening balance produces the agreed closing balance.
- Reopening and refreshing shows the saved result; the appropriate department-scoped view sees the same schedule.
- Existing unrelated requests, identities, permissions, and schedules remain intact.

Expand one reviewed batch at a time. Keep an entry log of profile IDs, dates, request IDs, and expected balances so a second pass can skip work already completed. There is no one-click undo for an entire historical import; retain the backup and source records.
