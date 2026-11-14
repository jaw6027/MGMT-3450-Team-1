# Flightpath — marketing telemetry and drone sales dashboards

A responsive engineering-style marketing portal for MGMT 3450 Team 1, with a separate B2B/B2G sales workspace. Plain HTML, CSS, JavaScript, and SVG; no package installation, paid dependencies, external fonts, or database required for the demo. All sample data is simulated or fictional.

## Open the dashboard

Download this repository as a ZIP from GitHub (Code → Download ZIP), extract it, and open `index.html` in a modern browser. Keep both asset folders next to it. The link at the top opens `sales.html`, the original sales workspace.

For the database-connected Customer Dashboard and live endpoints, use the included local server (Node.js 24 recommended; at least 22.13 required for built-in SQLite):

```text
node server.cjs
```

Open `http://127.0.0.1:8765`. Stop the server with Ctrl+C. On PowerShell, set `$env:PORT=8766` first to use another port. This server serves dashboard assets and a sample customer API with validated create, update, and delete operations, and binds to your computer's loopback address. It is a local demonstration server, not a production backend.

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
- Add customer/company forms, editable contacts and qualification, military/civilian classification, industries and segments, product interests, and customer needs.
- Add or update sales opportunities and pipeline stages, add dated relationship notes, log communications, and schedule, reschedule, or complete follow-ups.
- Confirmed company deletion removes its linked contacts, opportunities, follow-ups, notes, and communications; campaigns remain with the deleted contacts removed.
- Explicit loading, unavailable-database, and no-match states. Connection failures do not display fabricated zero totals or silently substitute static data.

The sample database includes nine fictional organizations across all seven target segments and eleven fictional contacts. There is one existing customer and eight prospects. Private defense contractors are classified as civilian businesses even when they target military markets. Sector represents the existing market grouping, while customer type identifies the organization itself. All company, contact, deal, probability, and activity information is illustrative. Contact emails use `example.com`, and phone numbers use the fictional 202-555-01xx range.

Potential revenue is **open opportunity value in USD**, not earned revenue. Awarded, delivery, lost, and cancelled opportunities are excluded; weighted pipeline multiplies each open value by its illustrative win probability. Existing customers may also have new opportunities. Qualified leads means contacts explicitly marked **Sales qualified**. Company-level counts never count each contact as a separate company.

The editable demo API is local. Multi-user authentication and production deployment are future work. Do not put real customer information in tracked seed files. A deployed shared CRM requires authenticated backend access and an agreed database deployment; the existing PostgreSQL schema is a starting design, not a connected service.

The existing campaign, leads/accounts, pipeline, and sales overview views remain available and use the database records when the API is connected. Opening HTML directly from disk still supports the original static sales views, but the Customer Dashboard requires the Node server and reports an unavailable connection otherwise.

## Sales workspace

- `sales.html` opens the original campaigns, leads, accounts, and procurement pipeline dashboard. `dashboard/data.js` contains its fictional sample records.
- All amounts are USD. Open pipeline excludes awarded, lost, and cancelled opportunities. Weighted pipeline is the sum of each open deal's value multiplied by its illustrative win probability.
- Search matches account names, contacts, roles, opportunity names, and owners where relevant. Each panel displays matching records; campaign budgets always show full campaign budgets, while lead counts follow the current filters.
- The original sales sample records start from a November 12, 2026 snapshot and can now be updated through the Customer Dashboard. It supports sector/search filters, opportunity details, and CSV export. No live external integrations, authentication, or actual procurement/clearance verification is implemented. The new Customer Dashboard adds local sample database persistence.

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

## Editing customer records

1. Start `node server.cjs` from the repository root and open the sales workspace through that server.
2. Select **Customers → Add customer or company**. Company name, industry, and at least one segment are required. Choose the relationship, military/civilian type, and target market sector; these are separate classifications. Select an account owner and lead source when known.
3. Optionally add contacts, opportunities, and follow-ups with the section buttons. Required fields are marked. Opportunity amounts are whole USD; win probabilities are percentages. Add a note with an author, or log a communication to update the last-contact date.
4. Choose **Save customer**. The dashboard refreshes its records, charts, counts, search, and exports from the server response. New-company saves clear filters so the company is visible.
5. To update a customer, select its name in the customer directory and choose **Edit customer**. All existing contacts, opportunities, and follow-ups are available for editing. Existing notes and communication history are preserved; new entries are appended.
6. To delete, open the customer profile and choose **Delete customer**. Review the confirmation naming the company and linked data. Cancel leaves records unchanged. Confirm permanently removes that company and its linked records; there is no undo.

Forms preserve entered values on server validation or connection errors. A database revision prevents an old browser window from overwriting newer changes: close the form, use **Refresh records**, and reopen the customer after a conflict. After a connection loss during saving, check the refreshed records before retrying, since the server might already have completed the operation. Canceling an edit discards its unsaved changes.

Writes use same-origin JSON `POST /api/customers`, `PUT /api/customers/:id`, and `DELETE /api/customers/:id` with `X-Customer-Write: 1`. Validation and related record writes run in a single SQLite transaction. Company-only updates preserve omitted contacts and other linked records. IDs submitted for an existing linked record must belong to that company. No table is replaced or cleared during upgrades; startup adds revision/category metadata, new optional fields, and category membership tables to older databases, and existing seed markers prevent reseeding, even when all companies have intentionally been deleted.

The database path remains `.local/customers.sqlite` unless `CUSTOMER_DB_PATH` is set. Local changes stay on this machine; GitHub stores application code, not database records. A pre-upgrade backup for this environment is retained under `.local/backups/`. Do not delete or replace the live database to apply this upgrade; restart the Node server to load the new API code.

Automated checks use temporary databases and cover complete create/edit/delete flows, linked-record preservation, constraints and input errors, atomic rollback, stale-window conflicts, cross-origin write rejection, persistent changes after reopening, and prevention of accidental reseeding. Browser verification also exercises form validation, contact edits, mobile forms, follow-up completion, preserved note history, deletion cancellation/confirmation, connection failures, updated charts/search, and the existing marketing and sales views.

## Standard categories, account ownership, and follow-up alerts

The company editor uses a saved **Industry** dropdown and supports **multiple customer segments**. Choose a segment and select **Add segment**; use its × control to remove it from the selection. At least one segment is required. Military/civilian classification remains a separate field and does not change automatically when industries or segments change.

Use **+ New industry** or **+ New segment** to add a category. New categories are saved in the same transaction as the customer, become available for other companies, and remain available even if a company is deleted. Canceling the customer form discards unsaved category additions. Case and whitespace variations reuse the existing category instead of creating duplicates. Categories previously entered in the legacy database are retained and added to the saved lists during migration.

**Account owner** is a separate company field with Vanessa, Janice, Sherry, Austin, and Hannah as choices. Existing companies remain **Unassigned** until an owner is selected. **Lead source** is the company's recorded acquisition source: Referral, Website inquiry, Networking, Direct outreach, Industry event, or Other. Existing values start as **Not recorded** rather than guessed data. These fields appear in customer profiles, directory summaries, search, filters, and CSV exports.

Each contact now has a **Buyer role** dropdown: Technical evaluator, Decision-maker, Budget owner, or Procurement contact, plus Not recorded. This is independent of the contact's existing job title and qualification stage. Existing titles are preserved; no buyer role is inferred from them. Buyer roles are visible in profiles and included in customer search.

Three prominent follow-up indicators appear above the main KPI cards and use the current customer filters:

- **Overdue follow-ups:** incomplete tasks with a due date before today.
- **Follow-ups due this week:** incomplete tasks due from today through Sunday, inclusive, using UTC calendar dates. Earlier tasks in the same week are overdue instead.
- **Prospects without scheduled follow-ups:** prospect companies with no incomplete follow-up task. An overdue incomplete task counts as an existing task and is highlighted by the overdue indicator. Completed tasks do not count as scheduled follow-ups.

The migration operates in place on `.local/customers.sqlite`: it adds `organizations.accountOwner`, `organizations.leadSource`, and `leads.buyerRole`, plus `customer_categories` and `organization_segments`. Existing company, contact, opportunity, communication, note, campaign, and follow-up values are preserved. Each legacy segment becomes a segment membership. The legacy `segment` column remains available as the first selected segment for compatibility; the full selection is stored in the membership table. The pre-upgrade database backup is retained under `.local/backups/` in this environment.

Validation additionally covers repeatable legacy migration, preserved custom categories, multiple segments without duplicate company counts, all five owners, buyer-role/source validation, atomic rollback of failed category additions, persistence, and alert boundaries for today, Sunday, Monday, completed tasks, and empty results. Browser checks cover these controls on desktop and mobile and confirm the existing marketing and sales views still work.
