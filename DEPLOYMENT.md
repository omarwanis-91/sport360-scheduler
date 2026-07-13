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

`vercel.json` uses the same build command, output directory, and SPA fallback.
The project intentionally does not define an `npm start` script so Vercel treats the app as static output from `dist/` rather than a Node server/function.

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
