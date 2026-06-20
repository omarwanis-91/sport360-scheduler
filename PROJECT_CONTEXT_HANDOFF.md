# Sport360 Scheduler - Project Context Handoff

## 1. Main Goals

Sport360 Scheduler is a dark themed, Supabase-backed work scheduling web app for managing employees across departments.

The main product goals are:

- Provide sign-in for each person using Supabase Auth.
- Allow admins to create employee profiles before users have accounts.
- Allow employees to claim their pre-created profile by signing in with the matching email.
- Support multiple departments.
- Support department leads and admins managing current/future schedules.
- Show schedules horizontally:
  - Employees are rows.
  - Dates are columns.
  - Each cell shows the employee's shift/status for that day.
- Use simple shift/status labels, not accurate hours, overtime, or payroll logic.
- Support default weekly rotations per person.
- Support versioned rotations with effective start dates so future changes do not overwrite old schedule history.
- Support manual schedule overrides for specific people/dates.
- Support vacation requests, approvals, deductions, and schedule updates.
- Keep the UI dark, elegant, compact, premium, and easy to scan.
- Use red as the main brand/action accent, while schedule cells use status-specific visual language.

Core statuses currently supported:

- Morning
- Mid-day
- Night
- Weekend
- Vacation
- Sick
- On Ground
- Unassigned

Core roles:

- Admin
- Department Lead
- Employee

## 2. Next Steps

Recommended next steps in order:

1. Improve the schedule editing workflow further.
   - Current bulk editing exists inside the date header drawer.
   - Next improvement should be a cleaner, more polished daily editor UI.
   - It should feel less like a form and more like a compact schedule tool.

2. Improve vacation workflow visibility and approval ergonomics.
   - Pending vacation markers now appear in schedule cells.
   - Requests page now has filters.
   - Next step could be showing pending vacation impact before approval:
     - How many work days will be deducted.
     - Which schedule cells will become Vacation.
     - Whether balance is enough.

3. Improve profile and department management UI.
   - People section has filtering and profile editing.
   - Departments section has basic management and member list.
   - Next step should make departments feel like a real management area, not just stats.

4. Improve rotation builder UI.
   - Rotation logic is now weekday-based and works correctly.
   - The UI is consistent with the scheduler mood now, but still needs a more elegant editing flow.
   - It should be easy to edit rotations for multiple people in the same department while seeing the whole department.

5. Strengthen Supabase database/RLS setup.
   - Existing migrations support the main schema and policies.
   - Need to verify which migrations were applied in the Supabase SQL editor.
   - Need final cleanup migration once the schema stabilizes.

6. Add better audit and activity views.
   - Audit entries are recorded for important changes.
   - Activity page exists, but could become more useful with filters by employee, department, date, and action type.

7. Add production readiness.
   - Environment-based Supabase config.
   - Deployment instructions.
   - Better auth redirect handling.
   - Storage-backed photos instead of base64 profile images.
   - Better loading/error states.

## 3. What Works Well

### App Structure

- The app runs as a static JavaScript web app served by `server.js`.
- Local URL:
  - `http://127.0.0.1:4173`
- Main files:
  - `index.html`
  - `src/main.js`
  - `src/styles.css`
  - `src/supabaseStore.js`
  - `src/data.js`
  - `src/config.js`
  - `server.js`
- Supabase migrations live in:
  - `supabase/migrations/`

### Authentication And Profile Claiming

- Supabase sign-in works.
- Users can sign in with their email/password.
- Profiles are created separately from auth accounts.
- A signed-in user is linked to an employee profile when the email matches.
- Omar Wanis was correctly claimed as the signed-in/admin profile.
- Claimed/unclaimed display logic exists.
- Admin can unlink a profile account.

### Scheduler View

- Main schedule grid works.
- Employees are displayed as rows.
- Dates are displayed horizontally as columns.
- Department selector works.
- Range selector works:
  - Week
  - 2 Weeks
  - Month
- Filters exist:
  - All people
  - Leads
  - Unclaimed
  - On vacation
- Date headers open a right-side drawer.
- Shift cells open a right-side drawer.
- Employee cells open profile details.

### Shift Visual System

The current visual direction works well:

- Working states are more colorful:
  - Morning feels sunnier.
  - Night feels darker.
  - Mid-day feels warmer.
- Unavailable states are quieter:
  - Weekend is grey.
  - Vacation is grey with a green touch.
  - Sick is grey with a red touch.
- On Ground is visually separate as working but unavailable.
- Cells include an availability label:
  - Available
  - Unavailable
- This helps quickly scan who is actually available.

### Coverage Row

- Scheduler has a coverage row.
- It shows available count per day.
- Department coverage target exists.
- Green/red washed-out state was tuned visually.
- This helps identify staffing risk quickly.

### Schedule Editing

- Single-cell shift override works.
- Shift drawer can save manual overrides.
- Manual override can apply to a date range for the same employee.
- Date header drawer now has a daily bulk override editor.
- The daily bulk editor allows changing multiple people on the same date from one drawer.

### Rotation Logic

- Rotations are now weekday-based.
- Day 1 is equivalent to Monday, Day 2 to Tuesday, etc.
- If a rotation starts mid-week, it applies the correct weekday slot.
  - Example: if May 1 is Friday, the Friday slot applies on May 1.
- Rotations are versioned with effective start dates.
- Future rotation changes do not overwrite historical data.

### Vacation Flow

- Vacation request creation works.
- Vacation approvals work.
- Vacation rejection works.
- Approved vacation deducts scheduled work days.
- Approved vacation creates schedule overrides.
- Requests page works.
- Requests page now has filters:
  - Pending
  - Approved
  - Rejected
  - All
- Pending vacation can be surfaced in schedule cells.
- Profile drawer shows recent vacation requests.

### My Profile

- There is now a My Profile section.
- It shows the signed-in user's profile, balance, and upcoming shifts.
- User can edit their own profile where allowed.
- Photo upload exists with drag/drop or file picker.

### Profile Photos

- Profile photo upload works locally in the app.
- Current implementation stores selected images as base64 data URLs in the `photo_url` field.
- This is acceptable for now, but not ideal long term.

### Validation

- `npm.cmd run check` passes after recent changes.
- This command checks:
  - `server.js`
  - `src/config.js`
  - `src/data.js`
  - `src/supabaseStore.js`
  - `src/main.js`

## 4. What Doesn't Work

### Local Server Can Stop

- The local server may stop between sessions.
- When that happens, the browser shows:
  - `ERR_CONNECTION_REFUSED`
  - `127.0.0.1 refused to connect`
- Fix is to restart:
  - `node server.js 4173`

### Git Status May Be Blocked

- Running Git commands may show dubious ownership warnings.
- The repo may require adding safe directory config:
  - `git config --global --add safe.directory 'C:/Users/omar/Documents/New project 2'`
- Do not assume Git status is available until this is resolved.

### Supabase Migration State May Be Unclear

- Some migrations were applied manually through Supabase SQL editor.
- One migration paste previously failed due an unterminated SQL string.
- It is unclear whether every migration file in `supabase/migrations/` has been applied cleanly.
- Before production, database schema should be verified against the current migration files.

### Photo Storage Is Not Production-Ready

- Photos currently use base64 data URLs.
- This can bloat database rows.
- Supabase Storage should be used later.

### Daily Bulk Editor UI Is Functional But Not Beautiful

- The daily bulk editor exists inside the date header drawer.
- It was compacted after being too large.
- It still needs visual polish.
- It should eventually feel like a real schedule editor, not a small form.

### Rotation Builder UI Still Needs Refinement

- Rotation logic works.
- The rotation UI is closer to the scheduler style now.
- But it still needs interaction design improvements.
- It should be easier to edit a whole department's weekly pattern at once.

## 5. What Needs Fixing

### Apply And Verify Supabase Migrations

Need verify these migration areas:

- Initial schema.
- Weekday rotation normalization.
- Department coverage target.
- Hardened role/RLS policies.
- Own profile/photo RPC.
- Vacation approval RPC.

The database should be checked for:

- Tables existing with correct columns.
- RLS enabled.
- Policies not recursively calling themselves.
- RPC functions available to authenticated users where needed.
- Admin/lead permissions working as expected.

### Department Management

Needs improvement:

- Departments page should be more than stats.
- It should allow:
  - Editing department name.
  - Editing minimum coverage target.
  - Viewing members.
  - Creating member directly in department.
  - Opening schedule for that department.
  - Opening rotations for that department.
- Some of this exists, but it needs to be designed and tested as a complete workflow.

### People/Profile Management

Needs improvement:

- Make edit affordance more obvious.
- Profile cards should expose clearer actions.
- Role management should be easier to understand.
- Claimed/unclaimed state should be very clear.
- Need ensure only the actual matching email claims the profile.

### Vacation Approval Details

Needs improvement:

- Approval drawer should preview:
  - Requested date range.
  - Work days to deduct.
  - Current balance.
  - Remaining balance after approval.
  - Which dates will be changed to Vacation.
- If balance is insufficient, approval should be blocked or strongly warned.

### Schedule Editing Permissions

Needs careful testing:

- Admin can edit all schedules, including past data.
- Department lead can edit only their department and only current/future dates.
- Employee cannot edit schedule.
- Past schedule corrections should be admin-only.

### UI Compactness

The user prefers:

- Smaller text.
- Not overcrowded.
- Elegant dark UI.
- Clear priorities.
- No giant controls.
- No overly colorful unavailable states.
- Red as brand/action accent, not everywhere.

Any new UI should respect this.

### Browser Cache Busting

The app uses query-string cache versions in `index.html`.

Recent examples:

- `request-inbox-filters`
- `vacation-visibility`
- `compact-day-bulk`

When changing CSS/JS, update the version in `index.html` so the browser gets fresh files.

## 6. What Works Now But Will Be Better Later

### Static App Architecture

Works now:

- Simple static app with vanilla JavaScript.
- Easy to iterate quickly.

Better later:

- Move to a framework or organized module structure if the app grows.
- Add route-level views.
- Add reusable UI components.
- Add proper state management.

### Supabase Direct Client Use

Works now:

- Frontend talks directly to Supabase.
- RPCs handle some privileged logic.

Better later:

- More logic should move into RPCs or edge functions.
- Complex approval and audit flows should be server-authoritative.
- Avoid trusting frontend-calculated values for important deductions.

### Base64 Profile Photos

Works now:

- User can upload from PC.
- Preview works.
- Photo persists as a data URL.

Better later:

- Use Supabase Storage.
- Store only the public/signed image URL in the profile.
- Add image resizing/compression.

### Vacation Approval

Works now:

- Requests can be approved/rejected.
- Approved requests deduct balance.
- Approved requests create Vacation overrides.

Better later:

- Add approval preview.
- Add cancellation flow.
- Add partial approvals if needed.
- Add reason/comments on rejection.
- Add email or in-app notification.

### Rotation Builder

Works now:

- Weekly pattern maps to actual weekdays.
- Effective start date works.
- Versioning protects old data.

Better later:

- Department-wide rotation grid.
- Multi-person editing.
- Copy/paste weekly pattern.
- Template presets.
- Preview before applying.

### Schedule Overrides

Works now:

- Single-cell overrides.
- Date-range overrides for one employee.
- Daily bulk overrides for multiple employees on one date.

Better later:

- Multi-select cells.
- Drag-to-fill shifts.
- Copy day/week from one employee to another.
- Bulk clear overrides.
- Conflict warnings with vacations.

### Audit Log

Works now:

- Audit entries are created for many important actions.

Better later:

- Add filters.
- Add actor names.
- Add before/after details.
- Add department/date filters.

### Visual Design

Works now:

- Strong dark theme.
- Good schedule cell distinction.
- Premium direction matches references.

Better later:

- Final design pass after core workflows stabilize.
- Better responsive layout.
- More polished drawer layout.
- More consistent buttons, lists, and forms.
- More thoughtful empty/loading/error states.

## Current Local Development Notes

Workspace path:

```text
C:\Users\omar\Documents\New project 2
```

Run local server:

```powershell
node server.js 4173
```

Open:

```text
http://127.0.0.1:4173
```

Run validation:

```powershell
npm.cmd run check
```

Current important files:

```text
index.html
server.js
src/main.js
src/styles.css
src/supabaseStore.js
src/data.js
src/config.js
supabase/migrations/
```

Current Supabase project:

```text
https://zehdjadirhhiqfxudikp.supabase.co
```

Current UI direction:

- Dark mode first.
- Desktop first.
- Compact text.
- Rounded but not overly bubbly.
- Black/charcoal surfaces.
- White/grey text.
- Red as brand/action accent.
- Schedule cell color used mainly for working states.
- Unavailable states mostly grey with small color hints.

## Suggested Prompt For A New Chat

Use this if starting fresh:

```text
We are building Sport360 Scheduler in C:\Users\omar\Documents\New project 2.

Please read PROJECT_CONTEXT_HANDOFF.md first, then inspect src/main.js, src/styles.css, src/supabaseStore.js, and the Supabase migrations before making changes.

Continue from the current state. Do not restart the app or redesign from scratch. The immediate priority is to keep improving core scheduler workflows while preserving the dark compact UI direction.

Use npm.cmd run check after code changes.
```

