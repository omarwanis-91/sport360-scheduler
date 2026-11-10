# Schedule Analytics

## Activate

1. In Supabase SQL Editor, run `supabase/migrations/034_department_analytics.sql` after migrations 001–033.
2. Run `supabase/audit/022_department_analytics_audit.sql`. All five rows must be true.
3. Review and merge the matching Analytics client PR; verify Vercel and Netlify publish that commit.
4. Sign in as Admin and choose **Analytics** in the sidebar. Select November and 2026 from the dropdowns, then choose Video Edit. Check the shift mix against Scheduler, hover/tap a daily point for its popup, and select a month in the leave chart.
5. Verify a Lead sees only directly assigned departments and their people. Employee must not see Analytics and direct RPC calls must be rejected. Admin Role Preview is useful for client checks; actual Lead/Employee sessions verify database roles.

This migration adds one read-only function. It does not rewrite rotations, requests, exceptions, roles, or Annual balances. No service-role key is required in the browser. If the migration is missing, Analytics shows an error and Retry; other views remain available. While prelaunch mode is enabled, the existing non-Admin holding page still applies.

## Definitions

| Metric | Meaning |
| --- | --- |
| Scheduled work | Working person-days, including Morning, Mid-day, Night, Lead, and On Ground. One person working on two dates contributes two. |
| Shift mix | Mutually exclusive working categories. An assigned and available Lead replaces the underlying Morning/Mid-day/Night count. Ground is not an available Lead. |
| Average staffing | Working person-days divided by dates with at least one known saved shift. Fully unknown dates are excluded; known Weekend dates count as zero work. |
| Daily staffing | Saved work and Annual/Sick per date. Partial dates show known shifts and the count of unassigned people. Fully unknown dates are gaps. |
| Weekday rhythm | Mean/min/max working people on each weekday across known dates in the selected period, with sample counts. |
| Leave by month | Annual and Sick person-days from dated saved schedules, for the full selected calendar year. No saved schedule is displayed as a dash, distinct from a known zero. |
| Pending requests | Distinct pending Annual requests whose date ranges overlap the selected period. These do not reduce working counts until approval writes leave. |
| Schedule completeness | Known person-days divided by all people × dates in the selected scope/period. Includes work, Weekend, Annual, and Sick. |
| CSV | Exact per-person counts for the selected team and period, including unknowns. Spreadsheet formulas in names are neutralized. |

The dashboard is planned scheduling analysis, not attendance, hours, payroll, or productivity. Shared department members count once; similarly named profiles remain separate until an Admin resolves duplicates. Scope uses current department memberships because historical memberships are not stored. Manual Annual balance deductions have no dates and do not appear as historical leave. Current data begins in November 2026; missing earlier templates are not reconstructed.

## Controls and validation

Choose Team, Month, Year, and Month/Quarter/Year using dropdowns. The monthly leave chart always labels its full calendar year. Hover or focus a month for exact Annual/Sick values; select it to change the period. Hover or tap a daily chart point for its nearby values popup. Keyboard users can focus a point, use arrows/Home/End between dates, and press Escape to dismiss. A tap keeps the popup open until another selection, a tap outside the chart, or scrolling. The daily table remains an accessible alternative.

The dashboard uses larger reporting text, a full-width people table, and a larger gradient donut with aligned counts and small comparison tracks. Diffuse glows scale with the displayed values; zero work/leave values do not gain decorative data glow. These effects do not alter the numbers, categories, authorization, or saved schedule data. Reduced motion is supported.

Sort the People breakdown using column headers. Refresh reloads the authorized snapshot; CSV exports the filtered people totals. There are no writes from Analytics.

Automated checks: `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:analytics-db`, `npm.cmd run build`, and `npm.cmd run test:smoke`. Analytics smoke checks cover Chromium, focused Firefox/Edge runs, and widths 375/768/1024/1280/1920. SQL tests use isolated PostgreSQL and do not connect to production.
