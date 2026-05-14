# Shift Loom

Private shift scheduling app with Supabase auth, role-aware admin/member views, time-off requests, and Vercel-ready deployment.

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
3. Run `supabase/migrations/002_api_grants.sql` in the Supabase SQL editor.
4. Run `supabase/seed/001_demo_data.sql` if you want the starter departments, shifts, and people.
5. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Install dependencies with `npm install`.
7. Run locally with `npm run dev -- --port 5173`.

## First Admin

Invite the first admin from Supabase Auth. Then update their profile:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

Admins can create/link people in the app. Members should be invited through Supabase Auth, then linked to a person row by an admin.

## Deploy

Deploy to Vercel and set the same environment variables from `.env.example`. The app is private by default: signed-out users only see the sign-in screen.

You can also deploy to Netlify. The repo includes `netlify.toml`, so Netlify can use `npm run build` and publish `dist`.

After Vercel gives you a production URL, add it in Supabase:

- Authentication > URL Configuration > Site URL
- Authentication > URL Configuration > Redirect URLs

Keep `http://127.0.0.1:5173/` as a redirect URL while testing locally.
