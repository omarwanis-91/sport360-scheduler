# Sport360 Scheduler

Dark desktop-first scheduling prototype for departments, profile claiming, shift-label rotations, daily leads, and vacation approvals.

## Project Knowledge

- [Product vision](docs/VISION.md)
- [Phased roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decision log](docs/DECISIONS.md)
- [Current TODO](docs/TODO.md)
- [Supabase audit](docs/SUPABASE_AUDIT.md)
- [Production runbook](docs/PRODUCTION_RUNBOOK.md)
- [AI agent instructions](AGENTS.md)

`PROJECT_CONTEXT_HANDOFF.md` remains as a historical snapshot. The documents above are the living sources of truth.

## Run Locally

Create ignored `.env.local` using the variable names in `.env.example`. The local server generates browser runtime configuration from that file.

```powershell
npm run check
npm start
```

Open `http://127.0.0.1:4173`.

## Netlify Environment

Configure these variables under **Site configuration → Environment variables** before deploying:

- `SPORT360_SUPABASE_URL`
- `SPORT360_SUPABASE_ANON_KEY`
- `SPORT360_ALLOW_SIGNUP=false`
- `SPORT360_RELEASE` is optional because Netlify uses the commit reference by default.

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

The current application is configured for Supabase in `src/config.js`.

1. Review and apply the required files in `supabase/migrations/` in order.
2. Optionally run `supabase/seed.sql` for starter departments and profiles.
3. Confirm RLS policies and RPC permissions for each application role.
4. Create accounts using emails that match employee profiles. Sign-in links an account to the matching unclaimed profile.

The browser uses the public Supabase anon key. Never place a service-role key or private credential in frontend code.

## Free-Plan Manual Backup

Supabase Free projects do not have managed dashboard backups. Before migrations, production release, or bulk edits, use the manual export helper:

```powershell
npm.cmd run backup:manual
```

The helper writes SQL dumps outside the repository by default. See [Production runbook](docs/PRODUCTION_RUNBOOK.md) for restore rehearsal and rollback steps.
