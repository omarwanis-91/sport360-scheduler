# Team structure and profile editing

## Activation

1. Run `supabase/audit/023_team_structure_preflight.sql` in the Supabase SQL Editor before migration 035. No returned rows means there are no parent memberships to reconcile.
2. Rows marked ready for cleanup have an existing leaf-team assignment; migration 035 safely removes the redundant container membership. For a container-only person, use the current production Admin profile editor to explicitly select Video Edit, Motion Graphics, or both first. Do not guess their team or create a duplicate profile. Run the preflight again.
3. Apply `supabase/migrations/035_team_profile_structure.sql` after migration 034. Container-only assignments cause an explicit failure and rollback. Existing codes, names, photos, account links, schedules, rotation versions, requests, and Annual balances remain intact.
4. Run `supabase/audit/024_team_profile_structure_audit.sql`; all five checks must pass before merging/deploying the matching client.
5. After deployment, refresh the app and verify Team → person → Edit Profile. Check the centered modal, two leaf-team choices, Position and automatic Title, Role, Yearly allowance, and the separate current-year balance. Test Admin, Manager with Lead access, Manager with Employee access, and Artist accounts within their actual scopes.

Migration 035 derives operational titles for all existing profiles. Unassigned or other-team profiles use Artist, Lead, or Manager until assigned to the supported teams. Newly approved unassigned profiles therefore need an Admin team/position assignment; approval never guesses a team or access promotion.

## Titles

| Teams | Artist | Lead | Manager |
| --- | --- | --- | --- |
| Video Edit | Video Editor | Lead Video Editor | Head of Video Team |
| Motion Graphics | Motion Graphics | Lead Motion Graphics | Head of Motion Graphics |
| Both | Hybrid Artist | Lead Hybrid | Head of Video Unit |

Titles are computed by the database from full memberships and position. They cannot be manually overridden. Membership changes, hierarchy moves, and team renames refresh titles. Video Unit stays available for navigation and organization scope, while assignment choices and person tags show only the leaf team names. No one can be assigned to a container, including through legacy write paths. A populated team must be reassigned explicitly before it can become a parent container.

## Permissions

| Actor | Team/position changes | Other person's identity | Role/Annual balances |
| --- | --- | --- | --- |
| Admin | All profiles | Allowed | Allowed; sole Admin retained |
| Manager position + Lead role | Own teams only; position requires all target teams | Locked | Locked |
| Manager position + Employee role | Locked | Locked | Locked |
| Artist or Lead position + Lead role | Locked; schedule/request powers remain | Locked | Locked |
| Employee | Locked | Locked | Locked |

Everyone retains their own name/photo editing. A manager cannot remove their own team access or edit the sole Admin profile. A one-team manager may remove their own team's membership from a hybrid person without erasing the other membership; their global position stays locked. The modal closes if the person moves outside the viewer's scope. Manager structure saves are atomic and audited. Read-only Admin Role Preview cannot write.

Annual allowance is recurring configuration; Annual days left belongs to the displayed calendar year. Existing yearly renewal, archived balances, future reservations, and stale-form rejection remain enforced. Hiding Employee ID from editing does not remove or regenerate existing identifiers.

## Validation

`npm.cmd test` covers title derivation and preservation. `npm.cmd run test:structure-db` exercises migration preflight, triggers, authenticated/anonymous permissions, all nine titles, hybrid boundaries, legacy RPCs, atomic rejection, and unchanged operational records in isolated PostgreSQL. `smoke/profile-structure.smoke.spec.mjs` covers the profile modal, access rules, canonical saves, and five viewport widths. Tests use synthetic identities only.
