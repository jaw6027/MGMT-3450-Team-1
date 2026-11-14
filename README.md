# Flightpath — marketing telemetry and drone sales dashboards

A responsive engineering-style marketing portal for MGMT 3450 Team 1, with a separate B2B/B2G sales workspace. Plain HTML, CSS, JavaScript, and SVG; no package installation, paid dependencies, external fonts, or database required for the demo. All sample data is simulated or fictional.

## Open the dashboard

Download this repository as a ZIP from GitHub (Code → Download ZIP), extract it, and open `index.html` in a modern browser. Keep both asset folders next to it. The link at the top opens `sales.html`, the original sales workspace.

For the database-connected Customer Dashboard and live endpoints, use the included local server (Node.js 24 recommended; at least 22.13 required for built-in SQLite):

```text
node server.cjs
```

Open `http://127.0.0.1:8765`. Stop the server with Ctrl+C. On PowerShell, set `$env:PORT=8766` first to use another port. This server serves dashboard assets and a read-only sample customer API, and binds to your computer's loopback address. It is a local demonstration server, not a production backend.

## Marketing telemetry features

- Anchor navigation: Overview, Funnel Visualization, Campaign Trends, Alerts, Architecture.
- Six KPI cards: outreach spend, impressions, CTR, conversions, acquisition cost (CAC), and return on outreach spend (ROAS). Every card shows the selected buyer segment, or All buyer segments when aggregated.
- Interactive SVG funnel with demo sliders for impressions, CTR, click-to-lead rate, lead-to-conversion rate, and CPC. Widths use a square-root scale; color intensity represents stage conversion rate. Counts of zero produce no stage area.
- Forty recent buyer-segment intervals, a selectable SVG time-series chart, buyer-segment filtering, sortable table columns, and CSV export. Chart points expose exact values by hover or keyboard focus.
- Budget pacing notices at 80% and 100% of a configurable rolling-window budget, plus live connection and stale-data notices.
- Responsive layouts, keyboard controls, reduced-motion support, and an architecture diagram.

### Demo calculations

Demo samples cover four reporting segments: **Air Force / DoD Outreach**, **Navy / Maritime Contacts**, **Civilian Fleet Operators**, and **Technical Demo Requests**, with 15-second spacing across the full stream. Each segment therefore appears every 60 seconds. Funnel chips filter the funnel, KPI cards, chart, and table together; selecting the same chip again restores all segments. Buyer segments are parallel groups; impressions → clicks → leads → conversions remain sequential funnel stages. The dashboard starts with 40 samples and appends one every 15 seconds, retaining only 40. Changing a slider regenerates the demonstration window. Browser background throttling may delay updates.

KPIs and the funnel sum the displayed records for the selected buyer segment. CTR = total clicks / total impressions × 100. CAC = total spend / total conversions, using conversions as a customer acquisition proxy. ROAS = total attributed revenue / total spend. All four demo segments carry illustrative outreach costs. These amounts are simulated, not actual buyer spending. Demo attributed revenue is $180 per conversion. Ratios with a zero denominator display `—` and create gaps in the chart. Empty live data displays unavailable metrics rather than zero or demo estimates.

Budget notices use **all buyer segments** in the latest 40 records, independently of the buyer-segment filter. The budget is a cap for that rolling window, not a daily or monthly forecast. Thresholds are illustrative settings, not industry benchmarks. With an incomplete live window, the comparison uses only the received records. Controls, endpoint settings, and samples stay in browser memory and reset on reload.

## Connect a live API endpoint

1. Build a read-only backend endpoint that returns the JSON contract below. Keep advertising API credentials and platform OAuth tokens on your backend.
2. Serve this dashboard through `node server.cjs` or your static hosting service. Prefer same-origin API routing for deployment. For separate origins, configure the backend's CORS headers to permit the exact dashboard origin, such as `http://127.0.0.1:8765`.
3. Switch to **Live Mode (API Endpoint)**, enter the full URL, and select **Connect endpoint**. HTTPS is required except for HTTP on localhost/loopback during development.

The browser makes an immediate GET and polls every 15 seconds, with a 10-second timeout and `Accept: application/json`. It sends no cookies or authorization headers. This prototype therefore expects a publicly readable or separately controlled demonstration endpoint. Before adding private data, implement your backend's authentication and access controls; never embed secrets in JavaScript, GitHub files, or endpoint URLs.

Live mode disables simulation controls and clears all demo samples. Failed, malformed, or empty responses never fall back to mock data. Requests are cancelled when switching modes or changing endpoints, and late responses are ignored. A later request failure clears previously received live values. Source updates or latest intervals older than 60 seconds produce a stale-data notice.

### JSON response contract

The API retains the field name `channel` for compatibility. Populate it with the buyer-segment label you want displayed; live labels are read from the response without renaming them. Treat the four demo categories as mutually exclusive reporting buckets: a technical demo request assigned to that bucket must not also be counted under a sector bucket.

Return HTTP 200 with `Content-Type: application/json`:

```json
{
  "currency": "USD",
  "updatedAt": "2026-11-12T20:00:00Z",
  "intervals": [
    {
      "timestamp": "2026-11-12T20:00:00Z",
      "channel": "Air Force / DoD Outreach",
      "spend": 180.50,
      "impressions": 4000,
      "clicks": 96,
      "leads": 23,
      "conversions": 4,
      "revenue": 720
    }
  ]
}
```

Replace the example timestamps with actual source times; the example will become stale. Dates must be ISO timestamps with explicit time zones. `updatedAt` must be at least as recent as all intervals and no more than 60 seconds in the future. Amounts must be finite nonnegative JSON numbers (up to 1e12); audience counts must be nonnegative integers. The dashboard currently supports USD only; normalize other currencies in the backend.

Each record represents **non-overlapping, incremental** counts and amounts for one channel interval, not cumulative platform counters. Use unique timestamp/channel pairs. Counts must follow impressions ≥ clicks ≥ leads ≥ conversions for the same attributed cohort. Normalize CRM attribution and conversion lag in the bridge before sending data; platform reports using unrelated attribution windows cannot be directly combined into this funnel.

The browser validates up to 10,000 records, sorts by timestamp/channel, and retains the latest 40 **records across all channels**, not 40 per channel. The chart keeps source timestamps, including irregular spacing, and plots individual channel records rather than a sum of simultaneous channels. Empty `intervals: []` is accepted. Responses above 3 MB are rejected after reading. Backends should return the latest 40 records to keep transfers small. API failures, CORS errors, invalid counts, duplicate intervals, or unsupported currency show an explicit error.

The architecture diagram describes the intended upstream system. This repository does not implement advertising-platform connectors, platform authentication, the warehouse, or an ingestion bridge.

## Customer Dashboard

Run `node server.cjs` from the repository root, then open `sales.html` through the local server. **Customers** is the default sales-workspace view. The marketing dashboard remains at `index.html`; its assets and calculations are unchanged.

The dashboard reads `/api/customers`, backed by a persistent SQLite database at `.local/customers.sqlite`. The server creates and seeds it once; restarts preserve records and follow-up dates. No package installation, PostgreSQL service, or credentials are required. Set `CUSTOMER_DB_PATH` to use a separate database file, or `PORT` for another local port. The runtime database is ignored by Git. `database/customer-store.cjs` defines the relational demo tables; `database/demo.cjs` provides explicitly fictional records. No existing PostgreSQL schema is applied or replaced.

Features:

- Existing-customer and prospect organization counts, sales-qualified contact count, active opportunities, open pipeline value, and probability-weighted pipeline.
- Industry bar chart, military/civilian donut chart, and sales-stage chart with readable counts and amounts.
- Search across company names, all contacts and emails, phone numbers, product interests, needs, industries, segments, and notes. Combine sector, customer type, relationship, and industry filters. Cards, charts, table, follow-ups, and CSV export share the customer filters.
- Customer profiles with contacts, phone/email, product interests, needs, opportunities, recorded communication, notes, last-contact date, and next incomplete follow-up.
- Incomplete follow-ups ordered by due date, including overdue tasks. Dates are seeded relative to the database creation date and remain fixed afterward; status is evaluated against the current UTC date.
- Sample customer CSV export. This is an organization-level summary with the first listed contact; review a profile for all contacts and opportunities.
- Explicit loading, unavailable-database, and no-match states. Connection failures do not display fabricated zero totals or silently substitute static data.

The sample database includes nine fictional organizations across all seven target segments and eleven fictional contacts. There is one existing customer and eight prospects. Private defense contractors are classified as civilian businesses even when they target military markets. Sector represents the existing market grouping, while customer type identifies the organization itself. All company, contact, deal, probability, and activity information is illustrative. Contact emails use `example.com`, and phone numbers use the fictional 202-555-01xx range.

Potential revenue is **open opportunity value in USD**, not earned revenue. Awarded, delivery, lost, and cancelled opportunities are excluded; weighted pipeline multiplies each open value by its illustrative win probability. Existing customers may also have new opportunities. Qualified leads means contacts explicitly marked **Sales qualified**. Company-level counts never count each contact as a separate company.

The demo API is read-only and local. Editing records, multi-user authentication, and production deployment are future work. Do not put real customer information in tracked seed files. A deployed shared CRM requires authenticated backend access and an agreed database deployment; the existing PostgreSQL schema is a starting design, not a connected service.

The existing campaign, leads/accounts, pipeline, and sales overview views remain available and use the database records when the API is connected. Opening HTML directly from disk still supports the original static sales views, but the Customer Dashboard requires the Node server and reports an unavailable connection otherwise.

## Sales workspace

- `sales.html` opens the original campaigns, leads, accounts, and procurement pipeline dashboard. `dashboard/data.js` contains its fictional sample records.
- All amounts are USD. Open pipeline excludes awarded, lost, and cancelled opportunities. Weighted pipeline is the sum of each open deal's value multiplied by its illustrative win probability.
- Search matches account names, contacts, roles, opportunity names, and owners where relevant. Each panel displays matching records; campaign budgets always show full campaign budgets, while lead counts follow the current filters.
- The sales workspace is a fixed November 12, 2026 snapshot. It supports sector/search filters, opportunity details, and CSV export. No live external integrations, authentication, or actual procurement/clearance verification is implemented. The new Customer Dashboard adds local sample database persistence.

## Database design

`database/schema.sql` is the separate PostgreSQL design for the B2B/B2G sales backend. The SQLite-backed Customer Dashboard does not connect to this PostgreSQL design. It models organizations, campaigns, leads, engagements, and opportunities; it does not yet model the marketing buyer-segment intervals above. A future integration needs an authenticated backend, permission controls, a telemetry table/aggregation endpoint, and mapping of sales display labels to the schema enums. Database credentials must remain on the server.

## Verify the calculations

With Node.js installed, run:

```text
node --test dashboard/*.test.cjs marketing/*.test.cjs database/*.test.cjs
```

No additional packages are required. Tests cover sales pipeline totals, sector filters, search, references, marketing aggregation, zero denominators, slider propagation, API validation, sorting/truncation, empty responses, and CSV escaping. For browser checks: adjust a demo slider, change buyer segments and chart metrics, sort the table, trigger a budget warning, switch to live with no endpoint, and try valid/invalid endpoint responses. Verify that switching back to demo restores the sliders and samples.

## Sharing

GitHub stores this project code. This repository has not been configured for a hosted website. Download and open it locally, or configure static hosting such as GitHub Pages separately. Both pages use relative asset paths suitable for a repository subdirectory. The existing Drone SHM telemetry website is a separate project and is unchanged.

Customer checks additionally cover metric definitions, search, combined filters, profile dates, empty states, excluded stages, SQLite persistence and constraints, API responses, and database-file access restrictions.
