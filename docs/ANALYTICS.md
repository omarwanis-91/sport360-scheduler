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
| Shift mix | Working person-days by the saved shift. A daily Lead contributes once under their underlying working shift. |
| Average staffing | Working person-days divided by dates with at least one known saved shift. Fully unknown dates are excluded; known Weekend dates count as zero work. |
| Daily staffing | Saved work and Annual/Sick per date. Partial dates show known shifts and the count of unassigned people. Fully unknown dates are gaps. |
| Weekday rhythm | Mean/min/max working people on each weekday across known dates in the selected period, with sample counts. |
| Leave by month | Annual and Sick person-days for the selected calendar year, or for the selected months when using Custom. A dash marks a month without saved schedule data. |
| Pending requests | Distinct pending Annual requests whose date ranges overlap the selected period. These do not reduce working counts until approval writes leave. |
| Recorded schedule | Person-days with a saved status divided by all people × dates in the selected period. Scheduled work, days off, and leave all count. |
| CSV | Exact counts for the people shown in the breakdown, in its current order. Spreadsheet formulas in names are neutralized. |

The dashboard is planned scheduling analysis, not attendance, hours, payroll, or productivity. Shared department members count once; similarly named profiles remain separate until an Admin resolves duplicates. Scope uses current department memberships because historical memberships are not stored. Manual Annual balance deductions have no dates and do not appear as historical leave. Current data begins in November 2026; missing earlier templates are not reconstructed.

## Controls and validation

Choose Team and a Month, Quarter, Year, or Custom period. For Custom, choose a month and year for both From and Through, then select Apply range. Both months are included in full, and the range can cross calendar years. Hover or focus a month for exact Annual/Sick values. Selecting it opens the full month. Hover or tap a daily chart point for its nearby values popup. Keyboard users can focus a point, use arrows/Home/End between dates, and press Escape to dismiss. The daily table remains an accessible alternative.

The dashboard uses larger reporting text, a full-width people table, and a gradient donut with aligned counts and small comparison tracks. Small highlights fade toward lower values and disappear below the upper half of the chart’s value range. On bars they concentrate at the tip, and on lines they sit at the plotted peak values. Reduced motion is supported.

Filter People Breakdown by Manager, Lead, or Artist. Sort by Position or any other column using its header. Green and red identify the highest and lowest nonzero counts in each column among the displayed people. Tied extrema share a highlight when the column has different values. The Lead column tracks lead assignments separately from the Shift Mix chart. Refresh reloads the authorized schedule data for the current filters.

Automated checks: `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:analytics-db`, `npm.cmd run build`, and `npm.cmd run test:smoke`. Analytics smoke checks cover Chromium, focused Firefox/Edge runs, and widths 375/768/1024/1280/1920. SQL tests use isolated PostgreSQL and do not connect to production.
