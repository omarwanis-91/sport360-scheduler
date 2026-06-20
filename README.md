# Sport360 Scheduler

Dark desktop-first scheduling prototype for departments, profile claiming, shift-label rotations, daily leads, and vacation approvals.

## Run Locally

```powershell
npm run check
npm start
```

Open `http://127.0.0.1:4173`.

## What Is Implemented

- Dark Sport360 UI with red brand accent and compact hybrid scheduler grid.
- Rows are employee profiles; columns are schedule dates.
- Full shift labels with themed icon blocks for Morning, Night, Mid-day, Weekend, Vacation, Sick, and On Ground.
- Right-side drawer for shift overrides, people, vacation requests, rotations, statuses, and daily leads.
- Demo role switcher for admin, lead, and employee behavior.
- Per-person versioned rotation generation.
- Manual overrides for specific days.
- Vacation approval that deducts scheduled work days and writes Vacation overrides.
- Configurable status labels in the UI.
- Initial Supabase schema and RLS policies in `supabase/migrations/001_initial_scheduler_schema.sql`.

## Supabase Notes

The app uses seeded browser storage while `appConfig.demoMode` is `true`.

To use Supabase:

1. Run `supabase/migrations/001_initial_scheduler_schema.sql` in your Supabase project.
2. Optionally run `supabase/seed.sql` for starter departments and profiles.
3. Fill `src/config.js` with your Supabase project URL and anon key.
4. Set `appConfig.demoMode` to `false`.
5. Create accounts using emails that match employee profiles. On sign-in, `claim_profile_for_current_user()` links the account to the matching unclaimed profile.

The frontend imports Supabase JS from `supabaseConfig.clientUrl` when live mode is enabled. Demo mode does not use the network.
