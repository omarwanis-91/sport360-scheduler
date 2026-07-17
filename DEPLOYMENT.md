# Deployment

## Build

The project uses a dependency-free static build:

```powershell
npm.cmd run check
npm.cmd run build
```

The build recreates `dist/` and copies only `index.html` and `src/` into it.

## Netlify

`netlify.toml` configures:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA fallback: all paths return `index.html`

The existing Netlify project should deploy pull-request previews and production updates from GitHub.

## Vercel

`vercel.json` uses Vercel's native static output settings:

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: app routes return `index.html`

Do not add serverless `builds` entries for `src/*.js`; browser modules under `dist/assets/` must be served as static files, not invoked as Node functions.

## Supabase Authentication URLs

Add every active local, preview, and production URL in Supabase under Authentication > URL Configuration.

Local development:

```text
http://127.0.0.1:4173/
```

Production and preview URLs should use HTTPS.

## Security

- The frontend may use the public Supabase anon key.
- Never expose a service-role key, database password, or private token.
- Production authorization must remain enforced by Supabase RLS and RPC functions.
