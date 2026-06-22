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

