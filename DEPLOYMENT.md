# Deploy Shift Loom

## Current State

- The app builds with `npm.cmd run build`.
- Supabase Auth and database are connected through environment variables.
- Database setup requires three SQL runs:
  1. `supabase/migrations/001_initial_schema.sql`
  2. `supabase/migrations/002_api_grants.sql`
  3. `supabase/seed/001_demo_data.sql`

## GitHub

Create a new GitHub repository, then from this folder run:

```powershell
git init
git add .
git commit -m "Initial Shift Loom app"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

Do not commit `.env`; it is ignored by `.gitignore`.

## Vercel

1. Go to Vercel and import the GitHub repository.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add environment variables:

```env
VITE_SUPABASE_URL=https://rahlamjjcldjuvbeynty.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-or-anon-key
```

Use the publishable/anon public key only. Never use `sb_secret_...` or `service_role`.

## Supabase Redirects

After Vercel deploys, copy the production URL and add it to Supabase:

- Authentication > URL Configuration > Site URL
- Authentication > URL Configuration > Redirect URLs

Keep this local redirect for development:

```text
http://127.0.0.1:5173/
```

Add your production URL too:

```text
https://your-vercel-app.vercel.app/
```

## Netlify

Netlify is also supported and works well for this Vite app.

1. Go to Netlify and import the GitHub repository.
2. Build command: `npm run build`.
3. Publish directory: `dist`.
4. Add environment variables:

```env
VITE_SUPABASE_URL=https://rahlamjjcldjuvbeynty.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-or-anon-key
```

After Netlify deploys, copy the production URL and add it to Supabase:

- Authentication > URL Configuration > Site URL
- Authentication > URL Configuration > Redirect URLs

Example:

```text
https://your-netlify-site.netlify.app/
```
