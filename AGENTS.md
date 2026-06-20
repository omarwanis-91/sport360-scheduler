# Agent Instructions

This file defines repository-specific instructions for AI agents working on Sport360 Scheduler.

## Start Here

Before changing code, read:

1. `docs/VISION.md` for the product direction and boundaries.
2. `docs/ARCHITECTURE.md` for the current technical and visual structure.
3. `docs/DECISIONS.md` for decisions that should not be casually reversed.
4. `docs/TODO.md` for current priorities.

`PROJECT_CONTEXT_HANDOFF.md` is a historical snapshot. The files above are the living sources of truth.

## Working Rules

- Preserve the existing vanilla JavaScript architecture unless a framework migration is explicitly approved.
- Prefer existing helpers, rendering patterns, drawers, and CSS conventions over new abstractions.
- Keep changes scoped to the requested workflow. Do not refactor unrelated areas.
- Treat Supabase as the authoritative production data store.
- Add database changes as new migration files. Do not silently rewrite migrations that may already be applied.
- Keep authorization enforced by Supabase RLS/RPCs; frontend checks are only a UX layer.
- Never commit service-role keys, passwords, private tokens, or real user credentials.
- The Supabase anon key is public by design, but its use still depends on correct RLS policies.
- Avoid native browser `alert()`, `confirm()`, and `prompt()` dialogs. Use in-app notices or drawers.
- Update the query-string asset version in `index.html` whenever `src/main.js` or `src/styles.css` changes.
- Run `npm.cmd run check` after JavaScript changes and before publishing.
- After UI changes, state exactly where the user should navigate and what they should inspect.

## Product Rules

- The scheduler is department-based: people are rows and dates are columns.
- Rotational shifts are Morning, Mid-day, Night, and Weekend.
- Vacation, Sick, and On Ground are daily exceptions, not rotation templates.
- Rotation versions have effective dates so future changes do not rewrite history.
- Manual overrides apply to specific people and dates.
- Vacation approval deducts affected scheduled work days and writes Vacation overrides.
- Employee profiles may exist before an auth account and are claimed through matching email.
- Admins manage the system; department leads manage their departments; employees primarily view and request.

## UI Rules

- Keep the interface dark, compact, desktop-first, and operational rather than promotional.
- Use charcoal/black surfaces, restrained borders, compact typography, and red for brand actions or warnings.
- Use schedule-specific colors sparingly for rapid scanning; avoid tinting entire unrelated cards.
- Prefer icons, concise tags, and small status markers over repeated explanatory text.
- Drawers are for focused edits and lightweight details. Full profile/calendar experiences belong on full pages.
- Avoid oversized controls, excessive cards, nested cards, large empty areas, and noisy color treatments.

## Documentation Maintenance

- Update `docs/VISION.md` only when product direction or scope changes.
- Update `docs/ARCHITECTURE.md` when system structure, data flow, major modules, or visual foundations change.
- Append to `docs/DECISIONS.md` when a meaningful product or technical decision is agreed.
- Update `docs/TODO.md` whenever priorities or completion states change.
- Keep documentation changes in the same commit as the implementation they describe when practical.

## Git Workflow

- Use `main` as the stable branch.
- Create a focused branch for one coherent change, normally named `codex/<short-description>`.
- Commit only the files belonging to that change.
- Push the branch and review it through a pull request before merging into `main`.

